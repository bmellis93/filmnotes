"use client";

import RecipientShareModal from "@/components/share/RecipientShareModal";
import type { StackMap } from "@/components/domain/stacks";

type Props = {
  open: boolean;
  onClose: () => void;
  galleryId: string;
  title: string;
  allowedVideoIds: string[];
  stacks: StackMap;
};

export default function ShareGalleryModal({
  open,
  onClose,
  galleryId,
  title,
  allowedVideoIds,
  stacks,
}: Props) {
  return (
    <RecipientShareModal
      open={open}
      onClose={onClose}
      subtitle="Send gallery link"
      subjectLabel="Gallery"
      subjectValue={`${title} (${allowedVideoIds.length} video${allowedVideoIds.length === 1 ? "" : "s"})`}
      defaultMessage={`Your gallery "${title}" is ready to review:`}
      sendDisabledReason={
        allowedVideoIds.length === 0 ? "No ready videos in this gallery yet." : null
      }
      createShare={async ({ contactId, allowComments, allowDownload }) => {
        const res = await fetch("/api/shares/create-gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            galleryId,
            title,
            allowedVideoIds,
            stacks,
            allowComments,
            allowDownload,
            view: "REVIEW_DOWNLOAD",
            contactId,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || "Failed to create share link" };
        }

        return { ok: true, url: data.url };
      }}
    />
  );
}
