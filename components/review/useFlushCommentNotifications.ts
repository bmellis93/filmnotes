"use client";

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 15 * 60 * 1000; // 15 minutes of inactivity after the last comment

type Opts = {
  enabled: boolean;
  token: string | undefined;
  videoId: string;
  /** Bump this whenever the client successfully posts a new comment, to reset the debounce timer. */
  commentsVersion: number;
};

/**
 * Batches client comment notifications instead of firing one webhook per
 * comment (see lib/notify/flushCommentNotifications.ts): flushes 15 minutes
 * after the reviewer's last comment, or immediately if they leave the page
 * or switch to another video in the gallery first. A daily cron
 * (app/api/cron/flush-comment-notifications/route.ts) is the fallback for
 * cases neither signal catches (tab killed, network failure, etc.).
 */
export function useFlushCommentNotifications({ enabled, token, videoId, commentsVersion }: Opts) {
  // A ref (not useCallback) so effects below can add listeners once and
  // still always call the latest enabled/token/videoId via this closure.
  const flush = useRef<() => void>(() => {});
  flush.current = () => {
    if (!enabled || !token) return;
    fetch("/api/comments/notify-flush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, videoId }),
      keepalive: true,
    }).catch(() => {});
  };

  // Effect A: debounce -- reset a 15-minute timer every time a new comment lands.
  useEffect(() => {
    if (!enabled || commentsVersion === 0) return;

    const timer = setTimeout(() => flush.current(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, commentsVersion]);

  // Effect B: flush immediately if the reviewer leaves the tab/page.
  useEffect(() => {
    if (!enabled) return;

    function onPageHide() {
      flush.current();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush.current();
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);

  // Effect C: flush when switching to a different video within the same
  // gallery (in-app navigation -- no real page unload, so B won't fire).
  useEffect(() => {
    if (!enabled) return;
    return () => flush.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoId]);
}
