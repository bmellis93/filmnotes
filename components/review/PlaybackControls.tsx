"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Settings,
  Maximize,
  Minimize,
  ChevronDown,
} from "lucide-react";

const iconBtnBase =
  "inline-flex h-10 w-10 items-center justify-center rounded-lg transition " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 " +
  "[&>svg]:stroke-[1.75]";

const iconBtnMuted = `${iconBtnBase} text-neutral-300 hover:text-white hover:bg-neutral-900/60`;
const iconBtnActive = `${iconBtnBase} text-neutral-100 hover:text-white hover:bg-neutral-900/60`;

export type PlaybackMarker = {
  id: string;
  timecodeMs: number;
};

type Props = {
  isPlaying: boolean;
  onTogglePlay: () => void;

  currentMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  formatTime: (ms: number) => string;

  markers?: PlaybackMarker[];

  // volume
  volume: number; // 0..1
  muted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (next: number) => void;

  // comment
  canAddComment: boolean;
  onAddComment?: () => void;

  // loop + speed
  loop: boolean;
  onToggleLoop: () => void;

  playbackRate: number; // 0.25..1.75
  onPlaybackRateChange: (rate: number) => void;

  // viewer settings
  onToggleFullscreen: () => void;
  isFullscreen: boolean;

  // quality (real HLS renditions, when available)
  qualityLevels?: { index: number; label: string }[];
  currentQualityIndex?: number; // the level actually playing right now
  isAutoQuality?: boolean; // whether that level was chosen by ABR vs. pinned by the user
  isHlsActive?: boolean; // false when the browser plays HLS natively (no manual quality control possible)
  onQualityChange?: (index: number) => void;

  snapToZeroThreshold?: number; // default 0.02
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75];

export default function PlaybackControls({
  isPlaying,
  onTogglePlay,
  currentMs,
  durationMs,
  onSeek,
  formatTime,
  markers = [],

  volume,
  muted,
  onToggleMute,
  onVolumeChange,

  canAddComment,
  onAddComment,

  loop,
  onToggleLoop,

  playbackRate,
  onPlaybackRateChange,

  onToggleFullscreen,
  isFullscreen,

  qualityLevels = [],
  currentQualityIndex = -1,
  isAutoQuality = true,
  isHlsActive = false,
  onQualityChange,

  snapToZeroThreshold = 0.02,
}: Props) {
  const safeDuration = Math.max(durationMs, 1);
  const safeCurrent = Math.min(Math.max(currentMs, 0), safeDuration);

  const [speedOpen, setSpeedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const speedWrapRef = useRef<HTMLDivElement | null>(null);
  const settingsWrapRef = useRef<HTMLDivElement | null>(null);

  const closePopovers = () => {
    setSpeedOpen(false);
    setSettingsOpen(false);
  };

  const volumeIcon = useMemo(() => {
    if (muted || volume === 0) return <VolumeX className="h-5 w-5" />;
    if (volume < 0.5) return <Volume1 className="h-5 w-5" />;
    return <Volume2 className="h-5 w-5" />;
  }, [muted, volume]);

  // click outside + ESC closes popovers
  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!speedOpen && !settingsOpen) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;

      if (speedOpen && speedWrapRef.current && speedWrapRef.current.contains(t)) return;
      if (settingsOpen && settingsWrapRef.current && settingsWrapRef.current.contains(t)) return;

      closePopovers();
    }

    function onKey(e: KeyboardEvent) {
      if (!speedOpen && !settingsOpen) return;
      if (e.key === "Escape") closePopovers();
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [speedOpen, settingsOpen]);

  return (
    <div className="px-4 pb-3 pt-2">
      {/* Timeline row */}
      <div className="relative w-full">
        <input
          type="range"
          min={0}
          max={safeDuration}
          value={safeCurrent}
          disabled={durationMs <= 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full disabled:opacity-40"
          aria-label="Seek"
        />

        {/* Markers overlay */}
        <div className="pointer-events-none absolute inset-0">
          {durationMs > 0 &&
            markers
              .filter((m) => m.timecodeMs >= 0 && m.timecodeMs <= durationMs)
              .map((m) => {
                const pct = (m.timecodeMs / durationMs) * 100;
                const label = `Jump to ${formatTime(m.timecodeMs)}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    title={label}
                    onClick={() => onSeek(m.timecodeMs)}
                    className="pointer-events-auto absolute top-1/2 h-4 w-1 -translate-y-1/2 -translate-x-1/2 rounded-full bg-red-500 hover:bg-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                    style={{ left: `${pct}%` }}
                    aria-label={label}
                  />
                );
              })}
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-2 grid grid-cols-3 items-center">
        {/* LEFT cluster */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            className={iconBtnActive}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>

          {/* Loop (hide on small widths) */}
          <button
            type="button"
            onClick={onToggleLoop}
            className={[
              "hidden sm:inline-flex",
              loop ? iconBtnActive : iconBtnMuted,
            ].join(" ")}
            title={loop ? "Loop on" : "Loop off"}
            aria-label="Toggle loop"
            aria-pressed={loop}
          >
            <Repeat className="h-5 w-5" />
          </button>

          {/* Speed (hide on small widths) */}
          <div ref={speedWrapRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => {
                setSpeedOpen((v) => !v);
                setSettingsOpen(false);
              }}
              className="h-10 inline-flex items-center gap-1 rounded-lg px-2 text-neutral-300 hover:text-white hover:bg-neutral-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
              title="Playback speed"
              aria-label="Playback speed"
              aria-expanded={speedOpen}
              aria-haspopup="menu"
            >
              <span className="text-sm font-medium tracking-tight tabular-nums">
                {playbackRate.toFixed(2)}x
              </span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            <div
              role="menu"
              aria-label="Playback speed"
              className={[
                "absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-neutral-800 bg-neutral-950/95 p-2 shadow-xl backdrop-blur",
                "origin-bottom-left transform transition duration-150 ease-out",
                speedOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
              ].join(" ")}
            >
              <div className="grid grid-cols-4 gap-1">
                {SPEEDS.map((s) => {
                  const active = s === playbackRate;
                  return (
                    <button
                      key={s}
                      role="menuitemradio"
                      aria-checked={active}
                      type="button"
                      onClick={() => {
                        onPlaybackRateChange(s);
                        setSpeedOpen(false);
                      }}
                      className={[
                        "rounded-lg px-2 py-1 text-xs tabular-nums transition",
                        active
                          ? "bg-neutral-200 text-neutral-900"
                          : "bg-neutral-900 text-neutral-200 hover:bg-neutral-800",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700",
                      ].join(" ")}
                    >
                      {s}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Volume (hover/focus reveal slider) */}
          <div className="relative group flex items-center">
            <button
              type="button"
              onClick={onToggleMute}
              className={iconBtnMuted}
              title={muted || volume === 0 ? "Unmute" : "Mute"}
              aria-label="Toggle mute"
              aria-pressed={muted || volume === 0}
            >
              {volumeIcon}
            </button>

            {/* Desktop: to the right */}
            <div
              className={[
                "absolute left-full top-1/2 ml-1 -translate-y-1/2",
                "hidden sm:block",
                "pointer-events-none opacity-0 -translate-x-1",
                "group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-x-0",
                "group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-x-0",
                "transition duration-150 ease-out",
              ].join(" ")}
            >
              {/* hover bridge */}
              <div className="absolute right-full top-1/2 h-10 w-3 -translate-y-1/2" />
              <div className="relative rounded-lg bg-neutral-950/95 p-2 pr-4 shadow-xl backdrop-blur">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    let next = Number(e.target.value);
                    if (!Number.isFinite(next)) next = 0;
                    if (next <= snapToZeroThreshold) next = 0;
                    onVolumeChange(Math.max(0, Math.min(1, next)));
                  }}
                  className="w-40"
                  aria-label="Volume"
                />
                <div className="absolute inset-y-0 -right-3 w-6" />
              </div>
            </div>

            {/* Mobile/narrow: above */}
            <div
              className={[
                "absolute bottom-full left-0 mb-2",
                "block sm:hidden",
                "invisible opacity-0 translate-y-1",
                "group-hover:visible group-hover:opacity-100 group-hover:translate-y-0",
                "group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0",
                "transition duration-150 ease-out",
              ].join(" ")}
            >
              <div className="rounded-lg bg-neutral-950/95 p-2 shadow-xl backdrop-blur">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    let next = Number(e.target.value);
                    if (!Number.isFinite(next)) next = 0;
                    if (next <= snapToZeroThreshold) next = 0;
                    onVolumeChange(Math.max(0, Math.min(1, next)));
                  }}
                  className="w-40"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>

        {/* CENTER cluster */}
        <div className="flex items-center justify-center gap-4">
          <div className="tabular-nums text-sm text-neutral-200" aria-label="Time">
            {formatTime(safeCurrent)} / {durationMs ? formatTime(durationMs) : "—"}
          </div>

          {canAddComment && onAddComment && (
            <button
              type="button"
              onClick={onAddComment}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-800 bg-transparent px-4 text-sm font-semibold text-neutral-200 hover:bg-neutral-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
            >
              Add a Comment
            </button>
          )}
        </div>

        {/* RIGHT cluster */}
        <div className="flex items-center justify-end gap-4">
          {/* Viewer Settings */}
          <div ref={settingsWrapRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setSettingsOpen((v) => !v);
                setSpeedOpen(false);
              }}
              className={iconBtnMuted}
              title="Viewer settings"
              aria-label="Viewer settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
            >
              <Settings className="h-5 w-5" />
            </button>

            <div
              role="menu"
              aria-label="Viewer settings"
              className={[
                "absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-neutral-800 bg-neutral-950/95 p-3 shadow-xl backdrop-blur",
                "origin-bottom-right transform transition duration-150 ease-out",
                settingsOpen ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-95",
              ].join(" ")}
            >
              <div className="text-xs font-semibold text-neutral-300">Quality</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  role="menuitemradio"
                  aria-checked={isAutoQuality}
                  type="button"
                  disabled={!onQualityChange}
                  onClick={() => {
                    onQualityChange?.(-1);
                    setSettingsOpen(false);
                  }}
                  className={[
                    "rounded-lg px-2 py-1 text-xs transition",
                    isAutoQuality
                      ? "bg-neutral-200 text-neutral-900"
                      : "bg-neutral-900 text-neutral-200 hover:bg-neutral-800",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700",
                    "disabled:opacity-60 disabled:cursor-default",
                  ].join(" ")}
                >
                  {isAutoQuality && currentQualityIndex !== -1
                    ? `Auto (${qualityLevels.find((l) => l.index === currentQualityIndex)?.label ?? "…"})`
                    : "Auto"}
                </button>

                {qualityLevels
                  .slice()
                  .sort((a, b) => b.index - a.index)
                  .map((lvl) => {
                    const active = !isAutoQuality && currentQualityIndex === lvl.index;
                    return (
                      <button
                        key={lvl.index}
                        role="menuitemradio"
                        aria-checked={active}
                        type="button"
                        onClick={() => {
                          onQualityChange?.(lvl.index);
                          setSettingsOpen(false);
                        }}
                        className={[
                          "rounded-lg px-2 py-1 text-xs transition",
                          active
                            ? "bg-neutral-200 text-neutral-900"
                            : "bg-neutral-900 text-neutral-200 hover:bg-neutral-800",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700",
                        ].join(" ")}
                      >
                        {lvl.label}
                      </button>
                    );
                  })}
              </div>
              {qualityLevels.length === 0 && (
                <div className="mt-3 text-[11px] text-neutral-500">
                  {isHlsActive
                    ? "Detecting available qualities…"
                    : "This browser streams adaptive quality automatically; manual selection isn’t available here."}
                </div>
              )}
            </div>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className={iconBtnMuted}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}