// Caption display logic for the learner players: timing offsets, which line
// "reveal after the line" shows, word-by-word highlighting, and which words
// are glossary terms. Pure, so it's unit-tested.

import { findGlossaryTerm, type GlossaryTermRule } from './glossary'
import type { TextPiece } from './words'

export interface CaptionCue {
  startMs: number
  endMs: number
  text: string
}

/** Shifts every cue by `offsetMs` (positive = the text shows later). */
export function shiftCues<T extends CaptionCue>(cues: T[], offsetMs: number): T[] {
  if (!offsetMs) return cues
  return cues.map((c) => ({ ...c, startMs: Math.max(0, c.startMs + offsetMs), endMs: Math.max(0, c.endMs + offsetMs) }))
}

/**
 * "Reveal after the line": the most recent line that has finished — the
 * learner hears a line first, then sees it. Null before the first one ends.
 */
export function revealedCueIndex(cues: CaptionCue[], ms: number): number {
  let found = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i]!.endMs <= ms) found = i
    else if (cues[i]!.startMs > ms) break
  }
  return found
}

/**
 * The word being spoken, estimated from how far through the line playback
 * is, weighted by word length (tracks don't carry per-word timings). -1 when
 * outside the line.
 */
export function activeWordIndex(pieces: TextPiece[], cue: { startMs: number; endMs: number }, ms: number): number {
  if (ms < cue.startMs || ms >= cue.endMs) return -1
  const weights = pieces.map((p) => (p.word ? [...p.text].length : 0))
  const total = weights.reduce((a, b) => a + b, 0)
  if (!total) return -1
  const target = ((ms - cue.startMs) / (cue.endMs - cue.startMs)) * total
  let acc = 0
  for (let i = 0; i < pieces.length; i++) {
    if (!weights[i]) continue
    acc += weights[i]!
    if (target < acc) return i
  }
  return pieces.length - 1
}

/** For each piece, the glossary term it belongs to (or null) — so captions can underline terms. */
export function glossaryPieces(pieces: TextPiece[], terms: GlossaryTermRule[]): (GlossaryTermRule | null)[] {
  const text = pieces.map((p) => p.text).join('')
  const ranges: { start: number; end: number; term: GlossaryTermRule }[] = []
  for (const term of terms) {
    for (const [start, end] of findGlossaryTerm(text, term.source, term.caseSensitive)) ranges.push({ start, end, term })
  }
  if (!ranges.length) return pieces.map(() => null)
  let offset = 0
  return pieces.map((p) => {
    const start = offset
    offset += p.text.length
    return ranges.find((r) => start < r.end && offset > r.start)?.term ?? null
  })
}
