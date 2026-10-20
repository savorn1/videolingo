// The trim's timing, worked out in the browser: where a moment of the video lands in the trimmed result (so
// subtitles fit the edit — the same steps as the server's MarkerTiming), how long the result is, and what the
// preview does to play the timing (speed parts, pauses). Times in ms. Pure, so tested.
import type { SpeedPart } from './videoMotion'

/** Held frames this close to the one kept before them are dropped (VideoEditRules.spacedHolds). */
const HOLD_SPACING_MS = 500

export interface TrimTiming {
  startMs: number
  endMs: number
  speeds: SpeedPart[]
  /** The held frame and pauses, on the trimmed clip (before the speed change). */
  holds: { atMs: number; durationMs: number }[]
  introMs: number
  outroMs: number
}

/** Where a moment of the trimmed clip ends up once each part plays at its speed (VideoEditRules.rampedAcross). */
export function rampedAt(ms: number, parts: SpeedPart[]): number {
  let shift = 0
  for (const r of [...parts].sort((a, b) => a.startMs - b.startMs)) {
    if (ms <= r.startMs) break
    const inside = Math.min(ms, r.endMs) - r.startMs
    shift += inside / r.speed - inside
  }
  return ms + Math.round(shift)
}

/** The held frames in time order, moved along by the speed parts, without any within 0.5 s of the one kept before. */
export function rampedHolds(t: Pick<TrimTiming, 'holds' | 'speeds'>): { atMs: number; durationMs: number }[] {
  const out: { atMs: number; durationMs: number }[] = []
  for (const h of t.holds.map((h) => ({ atMs: rampedAt(h.atMs, t.speeds), durationMs: h.durationMs })).sort((a, b) => a.atMs - b.atMs)) {
    if (!out.length || h.atMs - out[out.length - 1]!.atMs >= HOLD_SPACING_MS) out.push(h)
  }
  return out
}

/**
 * Where a moment of the video lands in the result, or null outside the trim. `holdsAt` says whether a pause at that
 * very moment comes before it ('after', for where a line ends — it stays up through the pause) or not ('before').
 */
export function editedTime(atMs: number, t: TrimTiming, holdsAt: 'before' | 'after' = 'before'): number | null {
  if (atMs < t.startMs || atMs > t.endMs) return null
  const y = rampedAt(atMs - t.startMs, t.speeds)
  const held = rampedHolds(t)
    .filter((h) => (holdsAt === 'after' ? h.atMs <= y : h.atMs < y))
    .reduce((sum, h) => sum + h.durationMs, 0)
  return y + held + t.introMs
}

/** How long the result is: the trimmed clip at its speeds, with the pauses and the cards. */
export function resultLength(t: TrimTiming): number {
  return (editedTime(t.endMs, t, 'after') ?? t.introMs) + t.outroMs
}

/** The transcript's lines as they fall in the result: cut to the trim, moved along by the speed parts, pauses and intro card. */
export function editedCues(cues: { startMs: number; endMs: number; text: string }[], t: TrimTiming): { startMs: number; endMs: number; text: string }[] {
  return cues.flatMap((c) => {
    const s = Math.max(c.startMs, t.startMs)
    const e = Math.min(c.endMs, t.endMs)
    if (e - s < 100 || !c.text.trim()) return []
    return [{ startMs: editedTime(s, t)!, endMs: editedTime(e, t, 'after')!, text: c.text.trim() }]
  })
}

function srtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(Math.floor(total / 3_600_000))}:${two(Math.floor(total / 60_000) % 60)}:${two(Math.floor(total / 1000) % 60)},${String(total % 1000).padStart(3, '0')}`
}

/** An .srt file of the lines. */
export function cuesToSrt(cues: { startMs: number; endMs: number; text: string }[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`).join('\n')
}

/** The playback speed at a moment of the trimmed clip: the speed part's there, 1 elsewhere. */
export function speedAt(parts: SpeedPart[], clipMs: number): number {
  return parts.find((p) => clipMs >= p.startMs && clipMs < p.endMs)?.speed ?? 1
}

/** The pause passed when the preview played on from `fromMs` to `toMs` (trimmed-clip time), or null; a jump of a second or more isn't playing past it. */
export function pauseCrossed(holds: { atMs: number; durationMs: number }[], fromMs: number, toMs: number): { atMs: number; durationMs: number } | null {
  if (toMs <= fromMs || toMs - fromMs >= 1000) return null
  return holds.find((h) => h.atMs > fromMs && h.atMs <= toMs) ?? null
}
