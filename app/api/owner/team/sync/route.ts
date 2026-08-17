import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerContext, requireRole } from "@/lib/auth/ownerSession";
import { getGhlAccessToken, ghlHeaders } from "@/lib/ghl/client";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function POST() {
  try {
    const ctx = await requireOwnerContext();
    requireRole(ctx, "ADMIN");
    const { orgId } = ctx;
    const accessToken = await getGhlAccessToken(orgId);
    const GHL_BASE_URL = mustEnv("GHL_API_BASE_URL");

    const url = new URL(`${GHL_BASE_URL}/users/`);
    url.searchParams.set("locationId", orgId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: ghlHeaders(accessToken),
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `GHL users fetch failed (${res.status})`, detail: text },
        { status: 502 }
      );
    }

    const data = JSON.parse(text);
    const users: any[] = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : [];

    let synced = 0;
    for (const u of users) {
      const ghlUserId = String(u.id ?? u._id ?? "").trim();
      if (!ghlUserId) continue;

      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name || null;
      const email = u.email ?? null;
      const isGhlAdmin = String(u.roles?.role ?? "").toLowerCase() === "admin";

      await prisma.appUser.upsert({
        where: { id: ghlUserId },
        create: { id: ghlUserId, name, email },
        update: { name, email },
      });

      const existing = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: ghlUserId } },
        select: { role: true },
      });

      if (!existing) {
        // New member: seed from GHL's own admin/user flag.
        await prisma.orgMember.create({
          data: { orgId, userId: ghlUserId, role: isGhlAdmin ? "ADMIN" : "VIEWER" },
        });
      } else if (isGhlAdmin && existing.role !== "ADMIN") {
        // GHL's admin/owner flag is always a floor in this app -- promote,
        // but never touch (downgrade or otherwise) a role an app admin
        // has manually assigned to a non-GHL-admin member.
        await prisma.orgMember.update({
          where: { orgId_userId: { orgId, userId: ghlUserId } },
          data: { role: "ADMIN" },
        });
      }

      synced++;
    }

    return NextResponse.json({ ok: true, synced, total: users.length });
  } catch (err: any) {
    console.error("Team sync error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message === "Forbidden" ? "Forbidden" : "Server error", detail: err?.message || String(err) },
      { status: err?.message === "Forbidden" ? 403 : 500 }
    );
  }
}
