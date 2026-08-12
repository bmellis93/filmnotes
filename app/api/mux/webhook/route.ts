import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { STORAGE_LIMIT_BYTES } from "@/lib/storageLimit";
import { mux } from "@/lib/mux";
import { deleteFromR2, deleteFromR2Public } from "@/lib/r2Delete";

export const runtime = "nodejs";

function hlsUrl(playbackId?: string | null) {
  return playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
}

function thumbUrl(playbackId: string, timeSeconds: number) {
  const t = Math.max(0, Math.round(timeSeconds * 100) / 100);
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${t}`;
}

function pickThumbTime(duration?: number | null) {
  if (!duration || duration <= 0) return 1;
  if (duration <= 10) return Math.max(0.5, Math.min(2.5, duration * 0.25));
  return 5;
}

/**
 * (Optional but recommended) Verify Mux webhook signatures.
 * Add MUX_WEBHOOK_SIGNING_SECRET to .env.local
 */
async function verifyMuxSignature(req: NextRequest, rawBody: string) {
  const secret = process.env.MUX_WEBHOOK_SIGNING_SECRET;
  if (!secret) return; // if you don't set it, we skip verification

  const header = req.headers.get("mux-signature");
  if (!header) throw new Error("Missing mux-signature header");

  // Header looks like: "t=timestamp,v1=signature"
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string])
  );

  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw new Error("Invalid mux-signature header");

  // Mux signs: `${t}.${rawBody}` using HMAC-SHA256
  const data = `${t}.${rawBody}`;
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigHex = Buffer.from(sigBuf).toString("hex");

  // Constant-time compare
  const a = Buffer.from(sigHex, "hex");
  const b = Buffer.from(v1, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid webhook signature");
  }
}

async function hardBlockIfOverLimit(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      orgId: true,
      muxAssetId: true,
      originalKey: true,
      originalSize: true,
      deletedAt: true,
      thumbnailKey: true,
      thumbnailIsCustom: true,
    },
  });

  if (!video || video.deletedAt) return { blocked: false };

  const size = typeof video.originalSize === "number" ? video.originalSize : 0;
  if (!Number.isFinite(size) || size <= 0) return { blocked: false };
  
  const org = await prisma.org.findUnique({
    where: { id: video.orgId },
    select: { storageUsedBytes: true },
  });

  const used = org?.storageUsedBytes ?? BigInt(0);

  if (used <= STORAGE_LIMIT_BYTES) return { blocked: false };

  // We are over limit: delete this upload externally + tombstone it
  if (video.muxAssetId) {
    try { await mux.video.assets.delete(video.muxAssetId); } catch {}
  }
  if (video.originalKey) {
    try { await deleteFromR2(video.originalKey); } catch {}
  }
  if (video.thumbnailIsCustom && video.thumbnailKey) {
    try { await deleteFromR2Public(video.thumbnailKey); } catch {}
  }

  const dec = BigInt(size);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // remove joins/comments/shares if you want it "gone"
    await tx.galleryVideo.deleteMany({ where: { videoId: video.id } });
    await tx.comment.deleteMany({ where: { videoId: video.id } });
    await tx.shareLink.deleteMany({ where: { videoId: video.id } });

    await tx.video.update({
      where: { id: video.id },
      data: {
        status: "FAILED",
        deletedAt: now,
        archivedAt: null,
        thumbnailUrl: null,
        thumbnailKey: null,
        thumbnailIsCustom: false,
        playbackUrl: null,
        muxPlaybackId: null,
        muxPublicPlaybackId: null,
        muxAssetId: null,
      },
    });

    // decrement reserved storage
    if (dec > BigInt(0)) {
      await tx.org.update({
        where: { id: video.orgId },
        data: { storageUsedBytes: { decrement: dec } },
      });
    }
  });

  return { blocked: true };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    await verifyMuxSignature(req, rawBody);

    const evt = JSON.parse(rawBody) as any;
    const type = evt?.type as string | undefined;
    const obj = evt?.data as any;
    const duration = typeof obj?.duration === "number" ? obj.duration : null;

    const muxAssetId =
      (evt?.data?.id as string | undefined) ??
      (evt?.object?.id as string | undefined);

    const playbackIds = (obj?.playback_ids as { id: string; policy: string }[] | undefined) ?? [];
    // "signed" is used for the actual video stream (token required, short-lived);
    // "public" is used only for thumbnails/gifs, which don't need protecting.
    const muxPlaybackId =
      playbackIds.find((p) => p.policy === "signed")?.id ??
      playbackIds[0]?.id ??
      null;
    const muxPublicPlaybackId =
      playbackIds.find((p) => p.policy === "public")?.id ?? null;

    if (!muxAssetId) {
      return NextResponse.json({ ok: true, ignored: "Missing muxAssetId" });
    }

    // Find your video by muxAssetId
    const video = await prisma.video.findFirst({
      where: { muxAssetId },
      select: { id: true, thumbnailUrl: true, thumbnailIsCustom: true },
    });

    if (!video) {
      return NextResponse.json({ ok: true, ignored: "No matching video" });
    }

    // ✅ Enforce storage limit before marking READY
    const safety = await hardBlockIfOverLimit(video.id);
    if (safety.blocked) {
      return NextResponse.json({ ok: true, blocked: true });
    }

    /**
     * 🔥 HARD GUARANTEE: READY means playable
     */
    if (type === "video.asset.ready") {
      const playbackId = muxPlaybackId;
      const thumbPlaybackId = muxPublicPlaybackId ?? playbackId;

      await prisma.video.updateMany({
        where: { muxAssetId },
        data: {
          status: "READY",
          muxPlaybackId: playbackId,
          muxPublicPlaybackId,
          playbackUrl: playbackId ? hlsUrl(playbackId) : null,
          // Don't clobber a thumbnail the owner uploaded on purpose.
          ...(video.thumbnailIsCustom
            ? {}
            : {
                thumbnailUrl: thumbPlaybackId
                  ? thumbUrl(thumbPlaybackId, pickThumbTime(duration))
                  : null,
              }),
          failureReason: null,
        },
      });

      return NextResponse.json({ ok: true });
    }

    // Other status updates
    let status: "PROCESSING" | "FAILED" | null = null;
    if (type === "video.asset.errored") status = "FAILED";
    else if (type?.startsWith("video.asset.")) status = "PROCESSING";

    const dataToUpdate: any = {};
    if (status) dataToUpdate.status = status;

    // Save playback id + playbackUrl when we have it
    if (muxPlaybackId) {
      dataToUpdate.muxPlaybackId = muxPlaybackId;
      dataToUpdate.playbackUrl = hlsUrl(muxPlaybackId);
    }
    if (muxPublicPlaybackId) {
      dataToUpdate.muxPublicPlaybackId = muxPublicPlaybackId;
    }

    // If processing events arrive and we still don't have a thumb,
    // you *can* set one, but it may 404 until ready.
    // Safer is to only set thumbnail on ready (above). So this is optional.
    // Leaving it out keeps things cleaner.

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.video.update({
        where: { id: video.id },
        data: dataToUpdate,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("MUX WEBHOOK ERROR:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Webhook error" },
      { status: 400 }
    );
  }
}