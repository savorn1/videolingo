// Glossary checks for the subtitle editor. `containsGlossaryTerm` mirrors the
// backend's GlossaryPrompt.contains (the Translator follows the same rules),
// so what's flagged here is what the translation was told to do.

export interface GlossaryTermRule {
  source: string
  target: string
  doNotTranslate: boolean
  caseSensitive: boolean
  note?: string | null
  glossaryName?: string | null
}

export interface GlossaryHit {
  cueIndex: number
  source: string
  target: string
  message: string
}

// Scripts that separate words with spaces — only there does a whole-word
// check make sense. Khmer, Thai, Japanese, Chinese… match anywhere.
const SPACED = /[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{Nd}]/u
const WORD_CHAR = /[\p{L}\p{N}]/u

export function containsGlossaryTerm(text: string, term: string, caseSensitive: boolean): boolean {
  const needleRaw = term.trim()
  if (!needleRaw || !text) return false
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? needleRaw : needleRaw.toLowerCase()
  const chars = [...needle]
  const checkStart = SPACED.test(chars[0]!)
  const checkEnd = SPACED.test(chars[chars.length - 1]!)
  for (let from = hay.indexOf(needle); from >= 0; from = hay.indexOf(needle, from + 1)) {
    const end = from + needle.length
    const before = from > 0 ? String.fromCodePoint(hay.codePointAt(from - 1)!) : ''
    const after = end < hay.length ? String.fromCodePoint(hay.codePointAt(end)!) : ''
    const startOk = !checkStart || !before || !WORD_CHAR.test(before)
    const endOk = !checkEnd || !after || !WORD_CHAR.test(after)
    if (startOk && endOk) return true
  }
  return false
}

/**
 * Cues that still contain a glossary term's source wording without its
 * required translation — e.g. "dashboard" left in a Khmer track whose
 * glossary says "ផ្ទាំងគ្រប់គ្រង". "Don't translate" terms can't be checked
 * this way (keeping them is correct), so they're skipped.
 */
export function checkGlossary(cues: { text: string }[], terms: GlossaryTermRule[]): GlossaryHit[] {
  const rules = terms.filter((t) => !t.doNotTranslate && t.target.trim() && t.target.trim().toLowerCase() !== t.source.trim().toLowerCase())
  const hits: GlossaryHit[] = []
  cues.forEach((cue, cueIndex) => {
    for (const t of rules) {
      if (containsGlossaryTerm(cue.text, t.source, t.caseSensitive) && !containsGlossaryTerm(cue.text, t.target, false)) {
        hits.push({
          cueIndex,
          source: t.source,
          target: t.target,
          message: `“${t.source}” should be “${t.target}”${t.glossaryName ? ` (${t.glossaryName})` : ''}`
        })
      }
    }
  })
  return hits
}

export interface ParsedGlossaryTerm {
  source: string
  target: string
  doNotTranslate: boolean
  caseSensitive: boolean
  note: string | null
}

/**
 * Terms pasted as lines of "source,target[,note]" (commas, or tabs when
 * copied from a spreadsheet). A blank target or "=" means "don't
 * translate"; blank lines and lines starting with # are skipped.
 */
export function parseGlossaryLines(text: string): ParsedGlossaryTerm[] {
  const out: ParsedGlossaryTerm[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
    const source = cells[0] ?? ''
    if (!source) continue
    const target = cells[1] ?? ''
    const keep = !target || target === '='
    out.push({ source, target: keep ? source : target, doNotTranslate: keep, caseSensitive: false, note: cells[2] || null })
  }
  return out
}
