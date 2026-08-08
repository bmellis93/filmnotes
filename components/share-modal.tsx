"use client";

import RecipientShareModal from "@/components/share/RecipientShareModal";

export default function ShareModal({
  open,
  onClose,
  videoId,
}: {
  open: boolean;
  onClose: () => void;
  videoId: string;
}) {
  return (
    <RecipientShareModal
      open={open}
      onClose={onClose}
      subtitle="Send review link"
      subjectLabel="Video"
      subjectValue={videoId}
      defaultMessage="Your video is ready to review:"
      sendDisabledReason={!videoId ? "Missing videoId. Refresh the page and try again." : null}
      createShare={async ({ contactId, allowComments, allowDownload }) => {
        const res = await fetch("/api/shares/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId,
            allowComments,
            allowDownload,
            expiresInDays: 7,
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
