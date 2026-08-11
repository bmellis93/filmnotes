// components/share/ClientGalleryScreen.tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Film } from "lucide-react";
import ThemeToggleSimple from "@/components/ThemeToggleSimple";

import {
  buildChildToParent,
  latestIdForCard,
  type StackMap as ShareStackMap,
} from "@/components/domain/stacks";

export type ShareGalleryVideo = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  thumbnailUrl: string | null;
};

export type SharePermissions = {
  view: "VIEW_ONLY" | "REVIEW_DOWNLOAD";
  allowComments: boolean;
  allowDownload: boolean;
};

type Props = {
  shareId: string;
  title: string;
  videos: ShareGalleryVideo[];
  permissions: SharePermissions;
  stacks?: ShareStackMap;

  token?: string;

  // ✅ optional: let parent control open behavior
  onOpenVideo?: (cardId: string) => void;
};

export default function ClientGalleryScreen({
  shareId,
  title,
  videos,
  stacks = {},
  permissions,
  token,
  onOpenVideo,
}: Props) {
  const router = useRouter();

  const childToParent = useMemo(() => buildChildToParent(stacks), [stacks]);

  const visibleVideos = useMemo(() => {
    const hidden = new Set(childToParent.keys());
    return videos.filter((v) => !hidden.has(v.id));
  }, [videos, childToParent]);

  function openVideo(cardId: string) {
    // ✅ if parent provided an open handler, use it (keeps “latest” centralized there)
    if (onOpenVideo) {
      onOpenVideo(cardId);
      return;
    }

    const openId = latestIdForCard(cardId, stacks, childToParent);

    if (token) {
      router.push(`/r/${token}/videos/${openId}`);
      return;
    }

    router.push(`/share/${shareId}/videos/${openId}`);
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border-2)] bg-[var(--surface-0)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-[var(--text-1)]">{title}</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {permissions.view === "VIEW_ONLY" ? "View only" : "Review & download"}
            </div>
          </div>

          <ThemeToggleSimple />
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        {visibleVideos.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-1)] ring-1 ring-[var(--border-1)]">
                <Film className="h-5 w-5 text-[var(--text-2)]" />
              </div>
              <div>
                <div className="text-sm font-semibold">No videos available</div>
                <div className="text-sm text-[var(--text-muted)]">
                  This link may not have any videos yet.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleVideos.map((v) => {
              const isStackParent = Boolean(stacks[v.id]?.length && stacks[v.id].length > 1);
              const stackCount = stacks[v.id]?.length ?? 1;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => openVideo(v.id)}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--surface-0)]/40 hover:bg-[var(--surface-1)]/20 transition text-left"
                >
                  {isStackParent && (
                    <div className="absolute left-3 top-3 z-10 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-2 py-0.5 text-xs text-[var(--text-2)]">
                      Latest of {stackCount}
                    </div>
                  )}

                  <div className="aspect-video w-full bg-[var(--surface-0)]">
                    {v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-[var(--text-muted)]">
                        No thumbnail
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="truncate text-sm font-semibold text-[var(--text-1)]">{v.name}</div>
                    <div className="mt-1 truncate text-sm text-[var(--text-muted)]">
                      {v.description || "—"}
                    </div>
                    <div className="mt-3 text-xs text-neutral-500">
                      Created {new Date(v.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}