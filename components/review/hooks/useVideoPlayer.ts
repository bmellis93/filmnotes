"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SyntheticEvent } from "react";
import Hls from "hls.js";

export type QualityLevel = {
  index: number;
  height: number;
  bitrateKbps: number;
  label: string;
};

type UseVideoPlayerOptions = {
  // HLS (.m3u8) source to attach for real ABR quality switching.
  // Omit for compare-view style callers that manage their own <video src>.
  // Ignored when `playbackTokenUrl` is set.
  src?: string;

  // Preferred for Mux signed playback: an endpoint returning
  // { playbackId, token, expiresInSeconds }. The hook fetches an initial
  // token, attaches hls.js against the *unsigned* manifest URL, and injects
  // the current token onto every request via hls.js's xhrSetup -- so a
  // background refresh (scheduled before the token expires) never tears
  // down or restarts the hls.js session; playback just keeps using
  // whatever token is currently valid.
  playbackTokenUrl?: string;

  snapToZeroThreshold?: number; // default 0.02
  fsHintMs?: number; // default 2500
};

type UseVideoPlayerReturn = {
  // refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  viewerRef: React.RefObject<HTMLDivElement | null>;

  // state
  durationMs: number;
  currentMs: number;
  isPlaying: boolean;

  volume: number;
  muted: boolean;

  loop: boolean;
  playbackRate: number;

  isFullscreen: boolean;
  showFsHint: boolean;

  // quality (real, when the source is HLS and hls.js is driving playback)
  qualityLevels: QualityLevel[];
  currentQualityIndex: number; // the level actually playing right now
  isAutoQuality: boolean; // whether that level was chosen by ABR vs. pinned by the user
  isHlsActive: boolean; // false when the browser plays HLS natively (no manual quality control possible)
  setQualityLevel: (index: number) => void; // -1 = Auto

  // setters
  setLoop: React.Dispatch<React.SetStateAction<boolean>>;
  setPlaybackRate: React.Dispatch<React.SetStateAction<number>>;

  // controls/helpers
  syncDuration: () => void;
  togglePlay: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => Promise<void>;
  seekToMs: (ms: number) => void;
  formatTime: (ms: number) => string;
  getCurrentTimeMs: () => number;
  setVolumeSafe: (next: number) => void;
  pause: () => void;

  // handlers
  onPlay: () => void;
  onPause: () => void;
  onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata: () => void;
  onDurationChange: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function useVideoPlayer(opts: UseVideoPlayerOptions = {}): UseVideoPlayerReturn {
  const { src: legacySrc, playbackTokenUrl } = opts;
  const snapToZeroThreshold = opts.snapToZeroThreshold ?? 0.02;
  const fsHintMs = opts.fsHintMs ?? 2500;

  // Signed-playback state: resolvedSrc is the *unsigned* manifest URL (stable
  // for the component's lifetime), currentTokenRef always holds the latest
  // valid token, injected per-request via xhrSetup rather than by swapping
  // the src (which would tear down and restart the hls.js session).
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(
    playbackTokenUrl ? undefined : legacySrc
  );
  const currentTokenRef = useRef<string | null>(null);
  const isSignedRef = useRef(Boolean(playbackTokenUrl));

  useEffect(() => {
    isSignedRef.current = Boolean(playbackTokenUrl);

    if (!playbackTokenUrl) {
      setResolvedSrc(legacySrc);
      return;
    }

    let cancelled = false;
    let refreshTimer: number | undefined;

    async function fetchToken() {
      try {
        const res = await fetch(playbackTokenUrl!, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to get playback token");
        if (cancelled) return;

        currentTokenRef.current = data.token as string;
        setResolvedSrc((prev) => {
          const next = `https://stream.mux.com/${data.playbackId}.m3u8`;
          return prev === next ? prev : next;
        });

        const ttlMs = Math.max(30, Number(data.expiresInSeconds) || 0) * 1000;
        // Refresh at 80% of TTL, well before it actually expires.
        refreshTimer = window.setTimeout(fetchToken, ttlMs * 0.8);
      } catch (err) {
        console.error("Failed to fetch/refresh Mux playback token:", err);
        // Retry in a minute rather than leaving playback permanently stuck.
        if (!cancelled) refreshTimer = window.setTimeout(fetchToken, 60_000);
      }
    }

    fetchToken();

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
    };
  }, [playbackTokenUrl, legacySrc]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  const hlsRef = useRef<Hls | null>(null);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState(-1);
  const [isAutoQuality, setIsAutoQuality] = useState(true);
  const [isHlsActive, setIsHlsActive] = useState(false);

  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const lastVolumeRef = useRef(1);

  const [loop, setLoop] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFsHint, setShowFsHint] = useState(false);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, []);

  const getCurrentTimeMs = useCallback(() => {
    const v = videoRef.current;
    if (!v) return 0;
    const ms = v.currentTime * 1000;
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.floor(ms));
  }, []);

  const syncDuration = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    const d = v.duration; // seconds
    // HLS can temporarily report Infinity/NaN
    if (!Number.isFinite(d) || d <= 0) return;

    const next = Math.floor(d * 1000);
    setDurationMs(next);
  }, []);

  const seekToMs = useCallback(
    (ms: number) => {
      const v = videoRef.current;
      if (!v) return;

      let next = Number(ms);
      if (!Number.isFinite(next)) next = 0;
      next = Math.max(0, Math.floor(next));

      // clamp to duration if known
      if (durationMs > 0) next = clamp(next, 0, durationMs);

      v.currentTime = next / 1000;
      setCurrentMs(next);
    },
    [durationMs]
  );

  const pause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;

    syncDuration();

    if (v.paused) {
      v.play()
        .then(() => {
          // onPlay handler will also set this, but keep it snappy
          setIsPlaying(true);
        })
        .catch(() => {
          // Autoplay / gesture restrictions etc.
          setIsPlaying(false);
        });
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [syncDuration]);

  const setVolumeSafe = useCallback(
    (next: number) => {
      let v = Number(next);
      if (!Number.isFinite(v)) v = 0;
      v = clamp(v, 0, 1);

      if (v <= snapToZeroThreshold) v = 0;

      if (v > 0) lastVolumeRef.current = v;

      setVolume(v);
      setMuted(v === 0);
    },
    [snapToZeroThreshold]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nextMuted = !m;

      if (nextMuted) {
        if (volume > 0) lastVolumeRef.current = volume;
        setVolume(0);
      } else {
        const restore = lastVolumeRef.current > 0 ? lastVolumeRef.current : 1;
        setVolume(restore);
      }

      return nextMuted;
    });
  }, [volume]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const el = viewerRef.current;
      if (!el) return;

      // iOS Safari has no Fullscreen API on arbitrary elements at all --
      // only the <video> element itself supports going fullscreen, via the
      // non-standard webkitEnterFullscreen (which hands off to the native
      // player chrome, since that's the only fullscreen iOS offers).
      // Feature-detect rather than sniff the UA: requestFullscreen simply
      // doesn't exist on iOS Safari for non-video elements.
      if (typeof el.requestFullscreen !== "function") {
        const v = videoRef.current as
          | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
          | null;
        v?.webkitEnterFullscreen?.();
        return;
      }

      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (err) {
      console.error("Fullscreen failed:", err);
    }
  }, []);

  // fullscreen listener + hint
  useEffect(() => {
    function onFs() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // iOS's webkitEnterFullscreen path above never touches
  // document.fullscreenElement, so the listener above can't see it -- track
  // it separately via the non-standard begin/end events iOS fires on the
  // <video> element itself.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onBegin = () => setIsFullscreen(true);
    const onEnd = () => setIsFullscreen(false);

    v.addEventListener("webkitbeginfullscreen", onBegin);
    v.addEventListener("webkitendfullscreen", onEnd);
    return () => {
      v.removeEventListener("webkitbeginfullscreen", onBegin);
      v.removeEventListener("webkitendfullscreen", onEnd);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    setShowFsHint(true);
    const t = window.setTimeout(() => setShowFsHint(false), fsHintMs);
    return () => window.clearTimeout(t);
  }, [isFullscreen, fsHintMs]);

  // Try to start playback as soon as the source is ready to go, so the
  // viewer lands on a playing video instead of a static first frame.
  // Unmuted autoplay is blocked by most mobile browsers without a user
  // gesture; when that happens, fall back to muted autoplay so playback at
  // least visibly starts (the volume control lets them unmute afterward).
  const attemptAutoplay = useCallback((video: HTMLVideoElement) => {
    video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        video.muted = true;
        setMuted(true);
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay fully blocked (e.g. data-saver mode) -- leave it paused.
          });
      });
  }, []);

  // Attach the source: real hls.js (with quality-level control) where
  // supported, native playback otherwise (Safari's native HLS, or a
  // plain file before Mux has finished transcoding).
  useEffect(() => {
    const video = videoRef.current;
    const src = resolvedSrc;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setQualityLevels([]);
    setCurrentQualityIndex(-1);
    setIsAutoQuality(true);

    const isHlsSource = src.includes(".m3u8");

    // Inject the current token onto requests to Mux's main manifest domain.
    // Sub-playlist/segment requests Mux hands back point at a *different*
    // edge domain with their own baked-in signature (signature/expires/skid
    // params) derived from that top-level token -- appending our token onto
    // those breaks Mux's own signature check, so leave anything that
    // already carries a "signature" param untouched.
    const withCurrentToken = (url: string) => {
      if (!isSignedRef.current || !currentTokenRef.current) return url;
      try {
        const u = new URL(url);
        if (u.searchParams.has("signature")) return url;
        u.searchParams.set("token", currentTokenRef.current);
        return u.toString();
      } catch {
        return url;
      }
    };

    // Always prefer hls.js over native HLS (e.g. Safari) when MSE is
    // available, same approach YouTube's web player uses: native playback
    // gives the browser's built-in decoder no JS API for picking a quality
    // level, so relying on it means manual selection silently doesn't work
    // anywhere it's actually needed. Native <video src> is only a fallback
    // for engines without MSE support at all (e.g. very old iOS Safari).
    if (isHlsSource && Hls.isSupported()) {
      setIsHlsActive(true);

      const hls = new Hls(
        isSignedRef.current
          ? {
              // Inject the *current* token on every request (manifest and
              // segments alike) instead of baking one into the src -- this
              // is what lets a background token refresh apply silently,
              // without ever tearing down this hls.js session.
              xhrSetup: (xhr, url) => {
                xhr.open("GET", withCurrentToken(url), true);
              },
            }
          : undefined
      );
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_evt, data) => {
        const levels: QualityLevel[] = data.levels.map((lvl, i) => ({
          index: i,
          height: lvl.height,
          bitrateKbps: Math.round(lvl.bitrate / 1000),
          label: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)} kbps`,
        }));
        setQualityLevels(levels);
        attemptAutoplay(video);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_evt, data) => {
        setCurrentQualityIndex(data.level);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        console.error("hls.js fatal error:", data.type, data.details);
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            // Unrecoverable: fall back to native playback rather than a dead player.
            hls.destroy();
            hlsRef.current = null;
            setIsHlsActive(false);
            video.src = withCurrentToken(src);
            break;
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      // Native <video src> fallback (browsers without MSE support, now rare
      // since hls.js is used everywhere else): background token refresh
      // can't silently update an already-set src, so playback here is only
      // guaranteed for one token TTL. Acceptable given how narrow this path is.
      setIsHlsActive(false);
      video.src = withCurrentToken(src);
      attemptAutoplay(video);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [resolvedSrc, attemptAutoplay]);

  const setQualityLevel = useCallback((index: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setIsAutoQuality(index === -1);
    if (index !== -1) setCurrentQualityIndex(index);
  }, []);

  // sync settings into <video>
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = clamp(volume, 0, 1);
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = loop;
  }, [loop]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  // handlers
  const onPlay = useCallback(() => setIsPlaying(true), []);
  const onPause = useCallback(() => setIsPlaying(false), []);

  const onLoadedMetadata = useCallback(() => {
    syncDuration();
    setCurrentMs(getCurrentTimeMs());
  }, [syncDuration, getCurrentTimeMs]);

  const onDurationChange = useCallback(() => {
    // duration can update after loadedmetadata (stream variants, etc.)
    syncDuration();
  }, [syncDuration]);

  const onTimeUpdate = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
    const ms = e.currentTarget.currentTime * 1000;
    if (!Number.isFinite(ms)) return;
    setCurrentMs(Math.max(0, Math.floor(ms)));
  }, []);

  return {
    videoRef,
    viewerRef,

    durationMs,
    currentMs,
    isPlaying,

    volume,
    muted,

    loop,
    playbackRate,

    isFullscreen,
    showFsHint,

    qualityLevels,
    currentQualityIndex,
    isAutoQuality,
    isHlsActive,
    setQualityLevel,

    setLoop,
    setPlaybackRate,

    syncDuration,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    seekToMs,
    formatTime,
    getCurrentTimeMs,
    setVolumeSafe,
    pause,

    onPlay,
    onPause,
    onTimeUpdate,
    onLoadedMetadata,
    onDurationChange,
  };
}