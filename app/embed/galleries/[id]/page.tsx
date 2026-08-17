"use client";

import { use, useEffect, useState } from "react";
import GalleryDetailScreen from "@/components/owner/GalleryDetailScreen";
import type { OwnerGalleryDetail } from "@/lib/owner/galleryDetailData";
import { useEmbedSession } from "@/components/embed/useEmbedSession";
import { OwnerRoleProvider } from "@/components/owner/OwnerRoleContext";

export default function EmbedGalleryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { ready, role } = useEmbedSession();
  const [detail, setDetail] = useState<OwnerGalleryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    fetch(`/api/owner/galleries/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Gallery not found" : "Failed to load gallery");
        return res.json();
      })
      .then((data: OwnerGalleryDetail) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load gallery");
      });

    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  if (!ready || (!detail && !error)) {
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
    <OwnerRoleProvider role={role}>
      <GalleryDetailScreen
        gallery={detail!.gallery}
        initialVideos={detail!.initialVideos}
        initialStacks={detail!.initialStacks}
        basePath="/embed/galleries"
      />
    </OwnerRoleProvider>
  );
}
