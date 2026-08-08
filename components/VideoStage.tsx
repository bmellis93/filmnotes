"use client";

import React, { forwardRef } from "react";

type VideoStageProps = {
  // Optional: omit when the caller (e.g. useVideoPlayer) manages the
  // source itself, such as attaching hls.js for real quality switching.
  src?: string;
  poster?: string;

  className?: string; // outer wrapper
  videoClassName?: string; // the <video> itself

  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";

  onLoadedMetadata?: React.VideoHTMLAttributes<HTMLVideoElement>["onLoadedMetadata"];
  onLoadedData?: React.VideoHTMLAttributes<HTMLVideoElement>["onLoadedData"];
  onCanPlay?: React.VideoHTMLAttributes<HTMLVideoElement>["onCanPlay"];
  onDurationChange?: React.VideoHTMLAttributes<HTMLVideoElement>["onDurationChange"];
  onPlay?: React.VideoHTMLAttributes<HTMLVideoElement>["onPlay"];
  onPause?: React.VideoHTMLAttributes<HTMLVideoElement>["onPause"];
  onTimeUpdate?: React.VideoHTMLAttributes<HTMLVideoElement>["onTimeUpdate"];
  onEnded?: React.VideoHTMLAttributes<HTMLVideoElement>["onEnded"];
};

const VideoStage = forwardRef<HTMLVideoElement, VideoStageProps>(function VideoStage(
  {
    src,
    poster,
    className = "",
    videoClassName = "",
    playsInline = true,
    preload = "metadata",
    onLoadedMetadata,
    onLoadedData,
    onCanPlay,
    onDurationChange,
    onPlay,
    onPause,
    onTimeUpdate,
    onEnded,
  },
  ref
) {
  return (
    <div className={["h-full w-full bg-black", className].join(" ")}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        playsInline={playsInline}
        preload={preload}
        className={[
          "h-full w-full object-contain", // letterbox, never crop
          "select-none",
          videoClassName,
        ].join(" ")}
        onLoadedMetadata={onLoadedMetadata}
        onLoadedData={onLoadedData}
        onCanPlay={onCanPlay}
        onDurationChange={onDurationChange}
        onPlay={onPlay}
        onPause={onPause}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
    </div>
  );
});

export default VideoStage;