// components/review/TokenReviewClient.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import VideoReviewScreen from "@/components/review/VideoReviewScreen";
import ClientGalleryScreen from "@/components/share/ClientGalleryScreen";
import {
  buildChildToParent,
  latestIdForCard,
  sanitizeStacks,
  type StackMap,
} from "@/components/domain/stacks";
import type { SharePermissions, ShareGalleryVideo } from "@/components/share/ClientGalleryScreen";

type ShareView = "VIEW_ONLY" | "REVIEW_DOWNLOAD";

type Props = {
  token: string;

  // legacy single-video shares:
  videoId: string | null;

  allowComments: boolean;
  allowDownload: boolean;
  view: ShareView;

  // gallery shares:
  allowedVideoIdsJson: string | null;
  stacksJson: string | null;

  // if null, server should pass a fallback from DB
  title: string | null;

  // ✅ real video records (server-fetched)
  videos: ShareGalleryVideo[];
};

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function safeParseStacks(json: string | null): StackMap {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return sanitizeStacks(v);
  } catch {
    return {};
  }
}

export default function TokenReviewClient(props: Props) {
  const stacks = useMemo(() => safeParseStacks(props.stacksJson), [props.stacksJson]);
  const childToParent = useMemo(() => buildChildToParent(stacks), [stacks]);

  const permissions: SharePermissions = useMemo(
    () => ({
      view: props.view,
      allowComments: props.allowComments,
      allowDownload: props.allowDownload,
    }),
    [props.view, props.allowComments, props.allowDownload]
  );

  const isGallery = useMemo(() => {
    const arr = safeParseArray(props.allowedVideoIdsJson);
    return arr.length > 1 || Boolean(props.allowedVideoIdsJson);
  }, [props.allowedVideoIdsJson]);

  // In gallery mode, show grid first. In legacy single-video mode, open immediately.
  const [openVideoId, setOpenVideoId] = useState<string | null>(() => {
    if (!isGallery) return props.videoId ?? null;
    return null;
  });

  const resolveLatest = useCallback(
    (id: string) => latestIdForCard(id, stacks, childToParent),
    [stacks, childToParent]
  );

  // ✅ central click → open (always latest)
  const handleOpenFromGallery = useCallback(
    (cardId: string) => {
      setOpenVideoId(resolveLatest(cardId));
    },
    [resolveLatest]
  );

  // In legacy mode, if somehow no videoId was provided, fall back to first server video.
  const fallbackFirstId = props.videos[0]?.id ?? null;

  if (!props.videoId && !isGallery && !fallbackFirstId) {
    return (
      <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)] p-6">
        <div className="max-w-xl">
          <div className="text-lg font-semibold">No videos available</div>
          <div className="mt-2 text-[var(--text-muted)] text-sm">
            This link doesn’t have any videos attached.
          </div>
        </div>
      </div>
    );
  }

  // Gallery grid view
  if (isGallery && !openVideoId) {
    return (
      <ClientGalleryScreen
        shareId={props.token}
        title={props.title ?? "Client Gallery"}
        videos={props.videos}
        stacks={stacks}
        permissions={permissions}
        token={props.token}
        onOpenVideo={handleOpenFromGallery} // ✅ state-based open, always latest
      />
    );
  }

  // Video viewer
  const selected = openVideoId ?? props.videoId ?? fallbackFirstId!;
  const latest = resolveLatest(selected);

  return (
    <VideoReviewScreen
      mode="token"
      token={props.token}
      videoId={latest}
      permissions={{
        allowComments: props.allowComments,
        allowDownload: props.allowDownload,
      }}
    />
  );
}