// Pure math for the timeline editor: pixel/time conversion, zoom clamping
// and snap-to-timestamp. No DOM, so it's unit-tested directly.

export const MIN_PX_PER_SEC = 10
export const MAX_PX_PER_SEC = 400

export function msToPx(ms: number, pxPerSec: number): number {
  return (ms / 1000) * pxPerSec
}

export function pxToMs(px: number, pxPerSec: number): number {
  return (px / pxPerSec) * 1000
}

export function clampZoom(pxPerSec: number): number {
  return Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, pxPerSec))
}

/** Zooming in/out multiplies by this each step — a comfortable, non-jarring increment. */
export const ZOOM_STEP = 1.5

/**
 * The nearest of `targets` to `candidateMs`, if within `toleranceMs`;
 * otherwise `candidateMs` unchanged. Used when dragging the playhead or a
 * marker, so it lands exactly on a subtitle cue boundary or another marker
 * instead of a few milliseconds off.
 */
export function snapMs(candidateMs: number, targets: number[], toleranceMs: number): number {
  let best = candidateMs
  let bestDelta = toleranceMs
  for (const t of targets) {
    const delta = Math.abs(t - candidateMs)
    if (delta <= bestDelta) {
      best = t
      bestDelta = delta
    }
  }
  return best
}

/** Snap targets from a track of cues: every cue's start and end. */
export function cueSnapTargets(cues: { startMs: number; endMs: number }[]): number[] {
  const targets: number[] = []
  for (const c of cues) {
    targets.push(c.startMs, c.endMs)
  }
  return targets
}
