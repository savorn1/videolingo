// Edit by transcript: crossing out sentences of the video's transcript cuts those stretches out (Cut out).
// Sentences are the transcript's segments (no word timings exist). Cutting two neighbouring sentences
// also cuts the short pause between them, so what is left doesn't keep a stray gap.
import { mergeCutRanges, type CutRange } from './cutOut'

/** A pause this short between two crossed-out sentences is cut with them. */
export const BRIDGE_GAP_MS = 1500

export interface Sentence {
  startMs: number
  endMs: number
}

/** Whether the sentence is wholly inside the cuts (shown crossed out). */
export function isSentenceCut(s: Sentence, cuts: CutRange[]): boolean {
  return mergeCutRanges(cuts).some((c) => c.startMs <= s.startMs && c.endMs >= s.endMs)
}

/** The cuts with `range` taken out of them (a cut it lands inside is split in two). */
export function subtractCutRange(cuts: CutRange[], range: CutRange): CutRange[] {
  const out: CutRange[] = []
  for (const c of mergeCutRanges(cuts)) {
    if (c.endMs <= range.startMs || c.startMs >= range.endMs) out.push(c)
    else {
      if (c.startMs < range.startMs) out.push({ startMs: c.startMs, endMs: range.startMs })
      if (c.endMs > range.endMs) out.push({ startMs: range.endMs, endMs: c.endMs })
    }
  }
  return out
}

/**
 * Crosses sentence `index` out, or brings it back. Crossing out also takes the pause to a crossed-out
 * neighbour (when it is at most BRIDGE_GAP_MS); bringing back gives back the sentence and those pauses.
 */
export function toggleSentenceCut(sentences: Sentence[], index: number, cuts: CutRange[], durationMs: number): CutRange[] {
  const s = sentences[index]
  if (!s) return cuts
  const prev = sentences[index - 1]
  const next = sentences[index + 1]
  const bridgeBefore = prev && s.startMs - prev.endMs <= BRIDGE_GAP_MS && s.startMs >= prev.endMs
  const bridgeAfter = next && next.startMs - s.endMs <= BRIDGE_GAP_MS && next.startMs >= s.endMs
  if (isSentenceCut(s, cuts)) {
    // Back: the sentence, and the pauses either side that were cut along with it.
    const start = bridgeBefore ? prev!.endMs : s.startMs
    const end = bridgeAfter ? next!.startMs : s.endMs
    return subtractCutRange(cuts, { startMs: start, endMs: end })
  }
  const start = bridgeBefore && isSentenceCut(prev!, cuts) ? prev!.endMs : s.startMs
  const end = bridgeAfter && isSentenceCut(next!, cuts) ? next!.startMs : s.endMs
  return mergeCutRanges([...cuts, { startMs: Math.max(0, start), endMs: Math.min(durationMs || end, end) }])
}
