"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation, AnnotationPoint, AnnotationStroke } from "@/lib/annotations/types";

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  interactive: boolean;
  value: Annotation;
  onChange?: (next: Annotation) => void;
};

const STROKE_COLOR = "#ef4444"; // red-500, matches the app's timecode-chip red
const STROKE_WIDTH = 0.006; // fraction of the video content width
const DOT_RADIUS = 0.009;

function getContainedRect(containerW: number, containerH: number, mediaW: number, mediaH: number) {
  if (!mediaW || !mediaH || !containerW || !containerH) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const containerRatio = containerW / containerH;
  const mediaRatio = mediaW / mediaH;
  let width: number;
  let height: number;
  if (mediaRatio > containerRatio) {
    width = containerW;
    height = containerW / mediaRatio;
  } else {
    height = containerH;
    width = containerH * mediaRatio;
  }
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}

function strokePoints(stroke: AnnotationStroke) {
  return stroke.map((p) => `${p.x},${p.y}`).join(" ");
}

function StrokeShape({ stroke }: { stroke: AnnotationStroke }) {
  if (stroke.length <= 1) {
    const p = stroke[0];
    if (!p) return null;
    return <circle cx={p.x} cy={p.y} r={DOT_RADIUS} fill={STROKE_COLOR} />;
  }
  return (
    <polyline
      points={strokePoints(stroke)}
      fill="none"
      stroke={STROKE_COLOR}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function DrawingOverlay({ videoRef, interactive, value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [liveStroke, setLiveStroke] = useState<AnnotationStroke | null>(null);
  const drawingRef = useRef(false);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const mw = video?.videoWidth || cw;
    const mh = video?.videoHeight || ch;
    setRect(getContainedRect(cw, ch, mw, mh));
  }, [videoRef]);

  useEffect(() => {
    recompute();
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(recompute);
    ro.observe(container);

    const video = videoRef.current;
    video?.addEventListener("loadedmetadata", recompute);

    return () => {
      ro.disconnect();
      video?.removeEventListener("loadedmetadata", recompute);
    };
  }, [recompute, videoRef]);

  function pointFromEvent(e: React.PointerEvent<SVGSVGElement>): AnnotationPoint {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const b = svg.getBoundingClientRect();
    const x = b.width > 0 ? (e.clientX - b.left) / b.width : 0;
    const y = b.height > 0 ? (e.clientY - b.top) / b.height : 0;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    setLiveStroke([pointFromEvent(e)]);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!interactive || !drawingRef.current) return;
    setLiveStroke((prev) => (prev ? [...prev, pointFromEvent(e)] : [pointFromEvent(e)]));
  }

  function endStroke() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    // Read liveStroke directly rather than via a setState updater -- calling
    // another component's setter (onChange) from inside a functional update
    // violates React's render-purity rules (updaters can run during render).
    if (liveStroke && liveStroke.length >= 1) {
      onChange?.({ strokes: [...value.strokes, liveStroke] });
    }
    setLiveStroke(null);
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <svg
        ref={svgRef}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className={[
          "absolute",
          interactive ? "pointer-events-auto touch-none cursor-crosshair" : "pointer-events-none",
        ].join(" ")}
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
        onPointerCancel={endStroke}
      >
        {value.strokes.map((s, i) => (
          <StrokeShape key={i} stroke={s} />
        ))}
        {liveStroke && <StrokeShape stroke={liveStroke} />}
      </svg>
    </div>
  );
}
