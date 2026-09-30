// Editor playback maths: stepping one frame, working out the frame rate from
// what the browser actually presents, keeping playback inside a looped
// section, and the time display. Pure so they can be tested directly.

export const EDITOR_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

/** Used until the real rate has been measured (or when the browser can't). */
export const FALLBACK_FPS = 30

const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120]

/** The standard rate a measurement is closest to (within 3%), else the measurement itself. */
export function snapFps(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return FALLBACK_FPS
  const near = COMMON_FPS.reduce((best, f) => (Math.abs(f - raw) < Math.abs(best - raw) ? f : best))
  return Math.abs(near - raw) / near <= 0.03 ? near : Math.round(raw * 100) / 100
}

/**
 * Frame rate from the gaps (seconds of media time) between consecutive
 * presented frames. The median ignores the odd dropped or doubled frame;
 * null until there are enough samples to trust.
 */
export function estimateFps(deltas: number[], minSamples = 8): number | null {
  const d = deltas.filter((x) => x > 0.004 && x < 0.2).sort((a, b) => a - b)
  if (d.length < minSamples) return null
  const mid = Math.floor(d.length / 2)
  const median = d.length % 2 ? d[mid]! : (d[mid - 1]! + d[mid]!) / 2
  return snapFps(1 / median)
}

/**
 * The time to seek to for the previous (-1) or next (+1) frame. Lands in the
 * middle of the frame, so rounding in the browser can't show its neighbour.
 */
export function stepFrameTime(seconds: number, fps: number, dir: 1 | -1, durationSeconds?: number): number {
  const frame = Math.floor(seconds * fps + 1e-6)
  let target = Math.max(0, frame + dir)
  if (durationSeconds && durationSeconds > 0) target = Math.min(target, Math.max(0, Math.ceil(durationSeconds * fps) - 1))
  return (target + 0.5) / fps
}

/**
 * Where playback should jump to keep inside [start, end] (seconds), or null
 * when it's fine where it is. Past the end wraps to the start; well before
 * the start (someone seeked away) also goes to the start.
 */
export function loopedTime(seconds: number, [start, end]: [number, number]): number | null {
  if (end - start < 0.05) return null
  if (seconds >= end || seconds < start - 0.05) return start
  return null
}

/**
 * Typed time → milliseconds: "83", "83.5", "1:23", "1:23.45", "1:02:03". Null when it isn't a time.
 * The reverse of formatTimecode, for fields people type into.
 */
export function parseTimecode(text: string): number | null {
  const parts = text.trim().split(':')
  if (parts.length < 1 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0)
  return Math.round(seconds * 1000)
}

/** 83_450 → "1:23.45"; an hour or more → "1:02:03.45". */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 10))
  const cs = total % 100
  const s = Math.floor(total / 100) % 60
  const m = Math.floor(total / 6000) % 60
  const h = Math.floor(total / 360000)
  const two = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${two(m)}:${two(s)}.${two(cs)}` : `${m}:${two(s)}.${two(cs)}`
}
