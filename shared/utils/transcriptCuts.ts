// Edit by transcript: crossing out sentences of the video's transcript cuts those stretches out (Cut out).
// Sentences are the transcript's segments (no word timings exist). Cutting two neighbouring sentences
// also cuts the short pause between them, so what is left doesn't keep a stray gap.
import { MAX_CUTS, mergeCutRanges, validateCutOut, type CutRange } from './cutOut'

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

// ── By word (when speech-to-text timed the words) ──

export interface TimedWord {
  startMs: number
  endMs: number
  text: string
}

/** Cuts one word out, or brings it back. */
export function toggleWordCut(word: TimedWord, cuts: CutRange[]): CutRange[] {
  const range = { startMs: word.startMs, endMs: word.endMs }
  return isSentenceCut(range, cuts) ? subtractCutRange(cuts, range) : mergeCutRanges([...cuts, range])
}

/** Hesitations worth cutting, in a few languages' spellings (compared without punctuation, case-blind). */
export const FILLER_WORDS = ['um', 'uh', 'umm', 'uhm', 'er', 'erm', 'ah', 'eh', 'hmm', 'mm']

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** The filler words of the transcript, in time order. */
export function fillerWords(sentences: { words?: TimedWord[] | null }[], fillers: readonly string[] = FILLER_WORDS): TimedWord[] {
  return sentences.flatMap((s) => s.words ?? []).filter((w) => fillers.includes(bare(w.text)))
}

/**
 * Cuts for the filler words not already cut, in time order while they fit with the cuts there are: at most MAX_CUTS
 * in all, never leaving a piece shorter than MIN_KEPT_MS. `skipped` counts the ones left in by those rules.
 */
export function fillerWordCuts(words: TimedWord[], existing: CutRange[], durationMs: number): { cuts: CutRange[]; skipped: number } {
  const accepted: CutRange[] = []
  let skipped = 0
  for (const w of words) {
    const range = { startMs: w.startMs, endMs: w.endMs }
    if (isSentenceCut(range, [...existing, ...accepted])) continue
    const trial = mergeCutRanges([...existing, ...accepted, range])
    if (trial.length <= MAX_CUTS && validateCutOut(trial, durationMs || null) === null) accepted.push(range)
    else skipped++
  }
  return { cuts: accepted, skipped }
}
