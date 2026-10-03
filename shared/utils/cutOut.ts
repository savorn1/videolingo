// Cut out: ranges taken out of a video, the rest playing on as one video.
// Times are in ms. The backend (VideoEditRules.validateCuts) re-checks every
// rule here; these copies drive inline errors, the preview skip and the summary.

import { MAX_SEGMENTS, MIN_TRIM_MS } from './videoEdit'

export interface CutRange {
  startMs: number
  endMs: number
}

/** At most this many cuts at a time (the backend's MAX_SEGMENTS). */
export const MAX_CUTS = MAX_SEGMENTS

/** The shortest piece that may be left around or between cuts (the backend's MIN_KEPT_MS). */
export const MIN_KEPT_MS = MIN_TRIM_MS

/** Sorted by start, with overlapping or touching ranges joined. */
export function mergeCutRanges(cuts: CutRange[]): CutRange[] {
  const merged: CutRange[] = []
  for (const c of [...cuts].sort((a, b) => a.startMs - b.startMs)) {
    const last = merged[merged.length - 1]
    if (last && c.startMs <= last.endMs) last.endMs = Math.max(last.endMs, c.endMs)
    else merged.push({ ...c })
  }
  return merged
}

/** What stays once the cuts are taken out, in order. */
export function keptAfterCuts(cuts: CutRange[], durationMs: number): CutRange[] {
  const kept: CutRange[] = []
  let pos = 0
  for (const c of mergeCutRanges(cuts)) {
    if (c.startMs > pos) kept.push({ startMs: pos, endMs: Math.min(c.startMs, durationMs) })
    pos = Math.max(pos, c.endMs)
  }
  if (pos < durationMs) kept.push({ startMs: pos, endMs: durationMs })
  return kept
}

/** Length of the video after the cuts. */
export function lengthAfterCuts(cuts: CutRange[], durationMs: number): number {
  return keptAfterCuts(cuts, durationMs).reduce((sum, k) => sum + (k.endMs - k.startMs), 0)
}

/** Null = fine; otherwise why these cuts can't be rendered. */
export function validateCutOut(cuts: CutRange[], durationMs: number | null): string | null {
  if (!cuts.length) return 'Mark at least one range to cut out'
  if (cuts.length > MAX_CUTS) return `At most ${MAX_CUTS} cuts at a time`
  for (const [i, c] of cuts.entries()) {
    const at = `Cut ${i + 1}: `
    if (!Number.isFinite(c.startMs) || !Number.isFinite(c.endMs)) return `${at}enter both times`
    if (c.startMs < 0) return `${at}the start can't be before the beginning`
    if (c.endMs <= c.startMs) return `${at}the end must be after the start`
    if (durationMs && c.endMs > durationMs) return `${at}the end is past the end of the video`
  }
  if (!durationMs) return null
  const kept = keptAfterCuts(cuts, durationMs)
  if (!kept.length) return 'Nothing would be left of the video'
  if (kept.some((k) => k.endMs - k.startMs < MIN_KEPT_MS)) return `A piece left between the cuts would be shorter than ${MIN_KEPT_MS / 1000} s`
  return null
}

/** Where playback should jump to if `ms` is inside a cut (that cut's end); null when it isn't. */
export function cutSkipTarget(cuts: CutRange[], ms: number): number | null {
  for (const c of mergeCutRanges(cuts)) if (ms >= c.startMs && ms < c.endMs) return c.endMs
  return null
}

/** Adds a range between two marks (in either order), clamped into the video. Null when they are the same moment. */
export function cutBetween(aMs: number, bMs: number, durationMs: number): CutRange | null {
  const startMs = Math.max(0, Math.min(aMs, bMs))
  const endMs = Math.min(durationMs, Math.max(aMs, bMs))
  return endMs > startMs ? { startMs: Math.round(startMs), endMs: Math.round(endMs) } : null
}
