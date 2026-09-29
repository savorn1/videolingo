// Comparing what a learner typed (dictation) or said (shadowing, via
// speech-to-text) with the line itself, word by word. Case, punctuation and
// accents don't count against them. Languages written without spaces
// (Khmer, Thai, Chinese, Japanese…) are compared character by character.

export type DiffStatus = 'ok' | 'wrong' | 'missing' | 'extra'

export interface DiffToken {
  /** What the learner gave (for ok/wrong/extra), or the expected word (missing). */
  text: string
  status: DiffStatus
  /** For 'wrong': the word that was expected there. */
  expected?: string
}

export interface DiffResult {
  tokens: DiffToken[]
  /** Expected units matched exactly, 0–1. */
  score: number
  correct: number
  total: number
}

/** Scripts written without spaces between words. */
const UNSPACED = /[฀-໿က-႟ក-៿぀-ヿ㐀-鿿가-힯]/

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\p{M}']/gu, '')
    .replace(/^'+|'+$/g, '')
}

/** Words (or characters, for unspaced scripts) as shown, paired with their comparison form. */
export function tokenize(text: string, unspaced: boolean): { shown: string; key: string }[] {
  const parts = unspaced ? [...text.replace(/\s+/g, '')] : text.split(/\s+/)
  return parts.map((p) => ({ shown: p, key: normalizeWord(p) })).filter((t) => t.key.length > 0)
}

/** Khmer, Thai, Chinese… often put spaces only between phrases, so any of these scripts means comparing characters. */
export function isUnspaced(text: string): boolean {
  return UNSPACED.test(text)
}

/**
 * Aligns the answer to the expected line (longest common subsequence), then
 * pairs up leftover words in the same gap as "wrong" (with what was
 * expected), and the rest as "missing" or "extra".
 */
export function diffWords(expected: string, answer: string): DiffResult {
  const unspaced = isUnspaced(expected)
  const e = tokenize(expected, unspaced)
  const a = tokenize(answer, unspaced)
  const n = e.length
  const m = a.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = e[i]!.key === a[j]!.key ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const tokens: DiffToken[] = []
  let gapE: string[] = []
  let gapA: string[] = []
  const flush = () => {
    const paired = Math.min(gapE.length, gapA.length)
    for (let k = 0; k < paired; k++) tokens.push({ text: gapA[k]!, status: 'wrong', expected: gapE[k] })
    for (let k = paired; k < gapA.length; k++) tokens.push({ text: gapA[k]!, status: 'extra' })
    for (let k = paired; k < gapE.length; k++) tokens.push({ text: gapE[k]!, status: 'missing' })
    gapE = []
    gapA = []
  }

  let i = 0
  let j = 0
  let correct = 0
  while (i < n || j < m) {
    if (i < n && j < m && e[i]!.key === a[j]!.key) {
      flush()
      tokens.push({ text: a[j]!.shown, status: 'ok' })
      correct++
      i++
      j++
    } else if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      gapA.push(a[j]!.shown)
      j++
    } else {
      gapE.push(e[i]!.shown)
      i++
    }
  }
  flush()
  return { tokens, score: n ? correct / n : 0, correct, total: n }
}
