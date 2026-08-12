// A stroke is a freehand line: a list of points, each a fraction (0-1) of
// the video's actual rendered content rect (i.e. already letterbox-corrected,
// so it lines up correctly regardless of player size or aspect ratio).
export type AnnotationPoint = { x: number; y: number };
export type AnnotationStroke = AnnotationPoint[];
export type Annotation = { strokes: AnnotationStroke[] };

export function isEmptyAnnotation(a: Annotation | null | undefined): boolean {
  return !a || a.strokes.length === 0;
}

const MAX_STROKES = 200;
const MAX_POINTS_PER_STROKE = 2000;

function isFinitePoint(p: any): p is AnnotationPoint {
  return (
    p &&
    typeof p.x === "number" &&
    typeof p.y === "number" &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y)
  );
}

/** Validates/clamps untrusted client input before it's persisted. */
export function sanitizeAnnotationInput(raw: unknown): Annotation | null {
  if (!raw || typeof raw !== "object") return null;
  const strokesRaw = (raw as any).strokes;
  if (!Array.isArray(strokesRaw)) return null;

  const strokes: AnnotationStroke[] = [];
  for (const strokeRaw of strokesRaw.slice(0, MAX_STROKES)) {
    if (!Array.isArray(strokeRaw)) continue;
    const stroke = strokeRaw
      .filter(isFinitePoint)
      .slice(0, MAX_POINTS_PER_STROKE)
      .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }));
    if (stroke.length > 0) strokes.push(stroke);
  }

  return strokes.length > 0 ? { strokes } : null;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function parseAnnotationJson(json: string | null | undefined): Annotation | null {
  if (!json) return null;
  try {
    return sanitizeAnnotationInput(JSON.parse(json));
  } catch {
    return null;
  }
}
