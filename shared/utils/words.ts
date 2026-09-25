// Splits subtitle text into pieces a learner can click to look up. Uses
// Intl.Segmenter where the runtime has it — the only way to find word
// boundaries in scripts written without spaces (Khmer, Thai, Japanese,
// Chinese) — and falls back to splitting on spaces and punctuation.

export interface TextPiece {
  text: string
  /** A word worth looking up (not spaces, punctuation or numbers). */
  word: boolean
}

const NUMBER_ONLY = /^[\p{N}.,:%-]+$/u

export function splitWords(text: string, language?: string | null): TextPiece[] {
  if (!text) return []
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (lang?: string, opts?: { granularity: string }) => { segment(t: string): Iterable<{ segment: string; isWordLike?: boolean }> }
    }
  ).Segmenter
  if (Segmenter) {
    try {
      const seg = new Segmenter(language ?? undefined, { granularity: 'word' })
      return [...seg.segment(text)].map((s) => ({ text: s.segment, word: !!s.isWordLike && !NUMBER_ONLY.test(s.segment) }))
    } catch {
      // Unknown language tag — fall through.
    }
  }
  return text
    .split(/([\s\p{P}]+)/u)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, word: /\p{L}/u.test(t) && !/^[\s\p{P}]+$/u.test(t) }))
}
