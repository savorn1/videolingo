// Remove the pauses: from the quiet stretches the backend found (VideoEditService.pauses, PauseRules), the
// cuts that take them out — leaving a little quiet next to the speech so it doesn't sound clipped. The cuts
// join the Cut out ranges, so they obey its rules (at most MAX_CUTS, no piece left shorter than MIN_KEPT_MS).
import { MAX_CUTS, MIN_CUT_MS, mergeCutRanges, validateCutOut, type CutRange } from './cutOut'

/** How quiet a pause is (dB), as offered: a quiet room, or some background noise. */
export const PAUSE_LEVELS = [
  { label: 'Quiet room', value: -40 },
  { label: 'Some background noise', value: -30 }
] as const

export interface PauseOptions {
  /** Only pauses at least this long are cut. */
  minPauseMs: number
  /** Quiet kept next to the speech on each side of a cut. */
  keepMs: number
  durationMs: number
}

/**
 * The cuts for the pauses, longest first while they fit with the cuts already made: at most MAX_CUTS in all,
 * never leaving a piece shorter than MIN_KEPT_MS. `skipped` counts pauses long enough but left out by those rules.
 */
export function pausesToCuts(pauses: CutRange[], existing: CutRange[], o: PauseOptions): { cuts: CutRange[]; skipped: number; savedMs: number } {
  const candidates: CutRange[] = []
  for (const p of pauses) {
    if (p.endMs - p.startMs < o.minPauseMs) continue
    // At the very start or end there's no speech on that side to keep quiet for.
    const start = p.startMs <= 0 ? 0 : p.startMs + o.keepMs
    const end = o.durationMs && p.endMs >= o.durationMs ? o.durationMs : p.endMs - o.keepMs
    if (end - start >= MIN_CUT_MS) candidates.push({ startMs: Math.round(start), endMs: Math.round(end) })
  }
  candidates.sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))
  const accepted: CutRange[] = []
  let skipped = 0
  for (const c of candidates) {
    const trial = mergeCutRanges([...existing, ...accepted, c])
    if (trial.length <= MAX_CUTS && validateCutOut(trial, o.durationMs || null) === null) accepted.push(c)
    else skipped++
  }
  accepted.sort((a, b) => a.startMs - b.startMs)
  return { cuts: accepted, skipped, savedMs: accepted.reduce((n, c) => n + (c.endMs - c.startMs), 0) }
}

/** Why the pauses of a video can't be cut from the Videos list (bulk), or null. */
export function pauseCutSkip(v: { deleted: boolean; storageKey: string | null }): string | null {
  if (v.deleted) return 'in the trash'
  if (!v.storageKey) return 'a link video — only stored files can be edited'
  return null
}

/** The cuts for one video of the bulk action, and the line saying what was queued (or why nothing was). */
export function bulkPausePlan(
  found: { durationMs: number; pauses: CutRange[] },
  o: Omit<PauseOptions, 'durationMs'>
): { cuts: CutRange[]; line: string; skip: string | null } {
  const plan = pausesToCuts(found.pauses, [], { ...o, durationMs: found.durationMs })
  if (!plan.cuts.length) return { cuts: [], line: '', skip: found.pauses.length ? 'no pause is that long' : 'no pauses found' }
  const n = plan.cuts.length
  const saved = Math.round(plan.savedMs / 100) / 10
  return {
    cuts: plan.cuts,
    line: `${n} pause${n === 1 ? '' : 's'} cut, ${saved} s shorter${plan.skipped ? ` (${plan.skipped} left in)` : ''}`,
    skip: null
  }
}
