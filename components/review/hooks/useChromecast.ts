"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// No official TS types package is installed for the Cast Sender SDK --
// typing these as `any` rather than pulling in a dependency just for
// declarations for a handful of calls.
declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    chrome?: any;
    cast?: any;
  }
}

const CAST_SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js";

let sdkLoadPromise: Promise<boolean> | null = null;

// Loads Google's Cast Sender SDK exactly once per page, even if multiple
// players mount at once (e.g. compare view has two). The SDK signals
// readiness via a required global callback rather than a normal script
// "load" event, so that's what this awaits.
function loadCastSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.chrome?.cast?.isAvailable) return Promise.resolve(true);
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve) => {
    const prevCallback = window.__onGCastApiAvailable;
    window.__onGCastApiAvailable = (isAvailable: boolean) => {
      prevCallback?.(isAvailable);
      resolve(isAvailable);
    };

    if (!document.querySelector("script[data-cast-sender-sdk]")) {
      const script = document.createElement("script");
      script.src = CAST_SDK_URL;
      script.async = true;
      script.dataset.castSenderSdk = "true";
      document.head.appendChild(script);
    }
  });

  return sdkLoadPromise;
}

export type ChromecastMedia = {
  url: string;
  contentType?: string; // default "application/x-mpegURL"
  title?: string;
  poster?: string;
  currentTimeSec?: number;
};

type UseChromecastReturn = {
  isCastAvailable: boolean;
  isCasting: boolean;
  castDeviceName: string | null;
  startCast: (media: ChromecastMedia) => Promise<void>;
  stopCast: () => void;
};

export function useChromecast(): UseChromecastReturn {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const contextRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    loadCastSdk().then((available) => {
      if (cancelled || !available || !window.cast || !window.chrome) return;

      const context = window.cast.framework.CastContext.getInstance();
      // Default Media Receiver: a generic, pre-built receiver Google hosts
      // for free -- no custom receiver app or Cast console registration
      // needed for standard HLS playback.
      context.setOptions({
        receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });
      contextRef.current = context;

      const onCastStateChanged = () => {
        const state = context.getCastState();
        setIsCastAvailable(
          Boolean(state) && state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE
        );
      };

      const onSessionStateChanged = (e: any) => {
        const connected =
          e.sessionState === window.cast.framework.SessionState.SESSION_STARTED ||
          e.sessionState === window.cast.framework.SessionState.SESSION_RESUMED;

        const session = context.getCurrentSession();
        setIsCasting(connected);
        setCastDeviceName(connected ? session?.getCastDevice()?.friendlyName ?? null : null);
      };

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onCastStateChanged
      );
      context.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        onSessionStateChanged
      );

      onCastStateChanged();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const startCast = useCallback(async (media: ChromecastMedia) => {
    const context = contextRef.current;
    if (!context || !window.chrome || !window.cast) return;

    let session = context.getCurrentSession();
    if (!session) {
      await context.requestSession();
      session = context.getCurrentSession();
    }
    if (!session) return;

    const mediaInfo = new window.chrome.cast.media.MediaInfo(
      media.url,
      media.contentType ?? "application/x-mpegURL"
    );
    mediaInfo.streamType = window.chrome.cast.media.StreamType.BUFFERED;

    if (media.title || media.poster) {
      const metadata = new window.chrome.cast.media.GenericMediaMetadata();
      if (media.title) metadata.title = media.title;
      if (media.poster) metadata.images = [new window.chrome.cast.Image(media.poster)];
      mediaInfo.metadata = metadata;
    }

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    if (media.currentTimeSec) request.currentTime = media.currentTimeSec;

    await session.loadMedia(request);
    setIsCasting(true);
    setCastDeviceName(session.getCastDevice()?.friendlyName ?? null);
  }, []);

  const stopCast = useCallback(() => {
    const session = contextRef.current?.getCurrentSession();
    session?.endSession(true);
    setIsCasting(false);
    setCastDeviceName(null);
  }, []);

  return { isCastAvailable, isCasting, castDeviceName, startCast, stopCast };
}
