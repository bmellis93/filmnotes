"use client";

import { useEffect, useMemo, useRef, useState, SyntheticEvent, useCallback } from "react";
import VideoStage from "@/components/VideoStage";
import PlaybackControls from "@/components/review/PlaybackControls";
import { useVideoPlayer } from "@/components/review/hooks/useVideoPlayer";

type CompareVersion = {
  id: string;
  label: string;
  viewSrc: string;
};

type Props = {
  leftVersionId: string;
  rightVersionId: string;
  versions: CompareVersion[];
  onChangeLeft: (id: string) => void;
  onChangeRight: (id: string) => void;

  // optional if you want to control it from parent later
  defaultAudioSide?: "left" | "right";
};

function durMs(el: HTMLVideoElement | null) {
  if (!el) return 0;
  const d = el.duration;
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.floor(d * 1000);
}

export default function VideoCompareView({
  leftVersionId,
  rightVersionId,
  versions,
  onChangeLeft,
  onChangeRight,
  defaultAudioSide = "right",
}: Props) {
  const leftRef = useRef<HTMLVideoElement | null>(null);
  const rightRef = useRef<HTMLVideoElement | null>(null);

  const player = useVideoPlayer();

  const [audioSide, setAudioSide] = useState<"left" | "right">(defaultAudioSide);

  // Prefer longer duration (max of both videos)
  const [leftDurationMs, setLeftDurationMs] = useState(0);
  const [rightDurationMs, setRightDurationMs] = useState(0);
  const compareDurationMs = Math.max(leftDurationMs, rightDurationMs);

  // End tracking so we pause only when BOTH have ended
  const [endedLeft, setEndedLeft] = useState(false);
  const [endedRight, setEndedRight] = useState(false);

  const left = useMemo(
    () => versions.find((v) => v.id === leftVersionId),
    [versions, leftVersionId]
  );
  const right = useMemo(
    () => versions.find((v) => v.id === rightVersionId),
    [versions, rightVersionId]
  );

  // In compare mode, tell the hook which <video> is "active"
  useEffect(() => {
    player.videoRef.current = audioSide === "left" ? leftRef.current : rightRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSide, leftVersionId, rightVersionId]);

  const updateDurations = useCallback(() => {
    setLeftDurationMs(durMs(leftRef.current));
    setRightDurationMs(durMs(rightRef.current));
  }, []);

  // Attach native listeners for duration + ended (since VideoStageProps doesn't include onEnded)
  useEffect(() => {
    const l = leftRef.current;
    const r = rightRef.current;

    if (!l || !r) return;

    const onLoadedOrDuration = () => updateDurations();

    const onEndedL = () => setEndedLeft(true);
    const onEndedR = () => setEndedRight(true);

    l.addEventListener("loadedmetadata", onLoadedOrDuration);
    l.addEventListener("durationchange", onLoadedOrDuration);
    l.addEventListener("ended", onEndedL);

    r.addEventListener("loadedmetadata", onLoadedOrDuration);
    r.addEventListener("durationchange", onLoadedOrDuration);
    r.addEventListener("ended", onEndedR);

    // initial pull
    updateDurations();

    return () => {
      l.removeEventListener("loadedmetadata", onLoadedOrDuration);
      l.removeEventListener("durationchange", onLoadedOrDuration);
      l.removeEventListener("ended", onEndedL);

      r.removeEventListener("loadedmetadata", onLoadedOrDuration);
      r.removeEventListener("durationchange", onLoadedOrDuration);
      r.removeEventListener("ended", onEndedR);
    };
  }, [leftVersionId, rightVersionId, updateDurations]);

  // If BOTH ended, pause (instead of pausing when one ends)
  useEffect(() => {
    if (endedLeft && endedRight) {
      player.pause();
    }
  }, [endedLeft, endedRight, player]);

  /* ---------- sync FROM player → videos ---------- */
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;

    const t = player.currentMs / 1000;

    // If user seeks back earlier, clear ended flags so playback works again.
    // Use a tiny buffer because currentTime can be slightly before/after.
    const maxD = Math.max(leftDurationMs, rightDurationMs) / 1000;
    if (maxD > 0 && t < maxD - 0.05) {
      if (endedLeft) setEndedLeft(false);
      if (endedRight) setEndedRight(false);
    }

    if (Math.abs(leftRef.current.currentTime - t) > 0.04) leftRef.current.currentTime = t;
    if (Math.abs(rightRef.current.currentTime - t) > 0.04) rightRef.current.currentTime = t;
  }, [player.currentMs, leftDurationMs, rightDurationMs, endedLeft, endedRight]);

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;

    if (player.isPlaying) {
      // if both had ended and user hits play again, reset
      if (endedLeft) setEndedLeft(false);
      if (endedRight) setEndedRight(false);

      leftRef.current.play().catch(() => {});
      rightRef.current.play().catch(() => {});
    } else {
      leftRef.current.pause();
      rightRef.current.pause();
    }
  }, [player.isPlaying, endedLeft, endedRight]);

  /* ---------- AUDIO: only selected side audible ---------- */
  useEffect(() => {
    const sel = audioSide === "left" ? leftRef.current : rightRef.current;
    const other = audioSide === "left" ? rightRef.current : leftRef.current;

    if (other) {
      other.muted = true;
      other.volume = 0;
    }

    if (sel) {
      sel.muted = player.muted;
      sel.volume = player.muted ? 0 : player.volume;

      // re-apply (helps some browsers when toggling sides mid-play)
      sel.muted = player.muted;
    }
  }, [audioSide, player.muted, player.volume]);

  // Use the selected video's time updates to drive the hook (and we mirror to the other)
  const onSelectedTimeUpdate = (e: SyntheticEvent<HTMLVideoElement, Event>) => {
    player.onTimeUpdate(e);
  };

  // Keep the hook's internal duration in sync too (not used for UI duration here, but helpful)
  const syncDurationFromEither = () => {
    player.syncDuration();
    updateDurations();
  };

  const selectedClass =
    "rounded-lg border px-2 py-2 transition cursor-pointer select-none";

  return (
    <div className="flex h-full flex-col bg-neutral-950">
      {/* VIDEOS */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 sm:overflow-hidden">
        {/* LEFT */}
        <div className="flex min-h-[45vh] flex-col sm:min-h-0">
          <div
            onClick={() => setAudioSide("left")}
            className={
              selectedClass +
              (audioSide === "left"
                ? " border-emerald-500/60 bg-emerald-950/20"
                : " border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/60")
            }
            title="Select left audio"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-neutral-200">
                {audioSide === "left" ? "Audio: ON" : "Audio: off"}
              </div>

              <select
                value={leftVersionId}
                onChange={(e) => onChangeLeft(e.target.value)}
                className="rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-200 ring-1 ring-neutral-800"
                onClick={(e) => e.stopPropagation()}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="mt-2 min-h-0 flex-1"
            onClick={() => setAudioSide("left")}
            title="Select left"
          >
            <VideoStage
              ref={leftRef}
              src={left?.viewSrc ?? ""}
              className="h-full"
              onLoadedMetadata={syncDurationFromEither}
              onLoadedData={syncDurationFromEither}
              onCanPlay={syncDurationFromEither}
              onDurationChange={syncDurationFromEither}
              onTimeUpdate={audioSide === "left" ? onSelectedTimeUpdate : undefined}
              onPlay={player.onPlay}
              onPause={player.onPause}
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex min-h-[45vh] flex-col sm:min-h-0">
          <div
            onClick={() => setAudioSide("right")}
            className={
              selectedClass +
              (audioSide === "right"
                ? " border-emerald-500/60 bg-emerald-950/20"
                : " border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/60")
            }
            title="Select right audio"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-neutral-200">
                {audioSide === "right" ? "Audio: ON" : "Audio: off"}
              </div>

              <select
                value={rightVersionId}
                onChange={(e) => onChangeRight(e.target.value)}
                className="rounded bg-neutral-900 px-2 py-1 text-xs text-neutral-200 ring-1 ring-neutral-800"
                onClick={(e) => e.stopPropagation()}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="mt-2 min-h-0 flex-1"
            onClick={() => setAudioSide("right")}
            title="Select right"
          >
            <VideoStage
              ref={rightRef}
              src={right?.viewSrc ?? ""}
              className="h-full"
              onLoadedMetadata={syncDurationFromEither}
              onLoadedData={syncDurationFromEither}
              onCanPlay={syncDurationFromEither}
              onDurationChange={syncDurationFromEither}
              onTimeUpdate={audioSide === "right" ? onSelectedTimeUpdate : undefined}
              onPlay={player.onPlay}
              onPause={player.onPause}
            />
          </div>
        </div>
      </div>

      {/* UNIFIED CONTROLS */}
      <div className="shrink-0 bg-neutral-950/90 backdrop-blur">
        <PlaybackControls
          isPlaying={player.isPlaying}
          onTogglePlay={player.togglePlay}
          currentMs={player.currentMs}
          durationMs={compareDurationMs}
          onSeek={player.seekToMs}
          formatTime={player.formatTime}
          volume={player.volume}
          muted={player.muted}
          onToggleMute={player.toggleMute}
          onVolumeChange={player.setVolumeSafe}
          canAddComment={false}
          loop={player.loop}
          onToggleLoop={() => player.setLoop((v) => !v)}
          playbackRate={player.playbackRate}
          onPlaybackRateChange={player.setPlaybackRate}
          isFullscreen={player.isFullscreen}
          onToggleFullscreen={player.toggleFullscreen}
        />
      </div>
    </div>
  );
}