"use client";

import { use, useEffect, useState } from "react";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import type { OwnerVideoReviewData } from "@/lib/owner/videoReviewData";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { EmbedShell } from "@/components/embed/EmbedShell";

export default function EmbedVideoReviewPage({
  params,
}: {
  params: Promise<{ id: string; videoId: string }>;
}) {
  const { id: galleryId, videoId } = use(params);
  const { ready, role } = useEmbedSession();
  const [data, setData] = useState<OwnerVideoReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    fetch(`/api/owner/galleries/${galleryId}/videos/${videoId}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Video not found" : "Failed to load video");
        return res.json();
      })
      .then((json: OwnerVideoReviewData) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load video");
      });

    return () => {
      cancelled = true;
    };
  }, [ready, galleryId, videoId]);

  if (!ready || (!data && !error)) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-2)]">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-6">
        <div className="text-sm text-[var(--text-2)]">{error ?? "Couldn't load your permissions."}</div>
      </div>
    );
  }

  return (
    <EmbedShell role={role}>
      <VideoReviewScreen
        mode="owner"
        ownerRole={role}
        videoId={data!.videoId}
        projectTitle={data!.projectTitle}
        stacks={data!.stacks}
        videoMetaById={data!.videoMetaById}
        backHref={`/embed/galleries/${galleryId}`}
        view="REVIEW_DOWNLOAD"
        initialApprovalStatus={data!.initialApprovalStatus}
        initialApprovalUpdatedAt={data!.initialApprovalUpdatedAt}
        initialChangeNote={data!.initialChangeNote}
        viewInfo={data!.viewInfo}
      />
    </EmbedShell>
  );
}
