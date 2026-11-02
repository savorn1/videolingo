// Video from audio, the later options: chapters (from the file's own tags, shown on the picture and kept as
// chapter markers, or pasted as a list), colours taken from the cover, the highlight clip's title, intro/outro cards,
// and putting a batch in order and numbering its titles. Mirrors the backend (AudioToVideoRules chapters,
// VideoEditRules cards), which re-checks everything.
import { MAX_CARD_TEXT } from './trimExtras'
import { MAX_VIDEO_TITLE } from './videoEdit'

export interface ChapterMark {
  startMs: number
  title: string
}

export const MAX_CHAPTERS = 30
export const MAX_CHAPTER_TITLE = 80
/** Each chapter's title shows for 4 s, so chapters closer than this would overlap. */
export const MIN_CHAPTER_GAP_MS = 5000

/** Why the chapters can't be used (as the server will say), or null. */
export function chapterProblem(chapters: ChapterMark[]): string | null {
  if (chapters.length > MAX_CHAPTERS) return `At most ${MAX_CHAPTERS} chapters`
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]!
    if (!c.title.trim()) return `Chapter ${i + 1}: write its title`
    if (c.title.length > MAX_CHAPTER_TITLE) return `Chapter ${i + 1}: the title can be at most ${MAX_CHAPTER_TITLE} characters`
    if (c.startMs < 0 || (i && c.startMs - chapters[i - 1]!.startMs < MIN_CHAPTER_GAP_MS))
      return `Chapter ${i + 1}: chapters go in time order, at least ${MIN_CHAPTER_GAP_MS / 1000} s apart`
  }
  return null
}

/** Chapters as read from a file, made usable: in order, titled, trimmed to length, far enough apart, at most MAX_CHAPTERS. */
export function tidyChapters(chapters: ChapterMark[]): ChapterMark[] {
  const out: ChapterMark[] = []
  for (const c of [...chapters].sort((a, b) => a.startMs - b.startMs)) {
    const title = c.title.trim().slice(0, MAX_CHAPTER_TITLE)
    if (!title || !Number.isFinite(c.startMs) || c.startMs < 0) continue
    if (out.length && c.startMs - out[out.length - 1]!.startMs < MIN_CHAPTER_GAP_MS) continue
    out.push({ startMs: Math.round(c.startMs), title })
    if (out.length === MAX_CHAPTERS) break
  }
  return out
}

/**
 * The chapters of one part of a recording (`startMs`–`endMs`), on the part's own time: the ones starting inside it,
 * plus the one already running when it starts (shown from 0:00, when the next is far enough away).
 */
export function chaptersForPart(chapters: ChapterMark[], part: { startMs: number; endMs: number } | null): ChapterMark[] {
  if (!part) return chapters
  const inside = chapters.filter((c) => c.startMs >= part.startMs && c.startMs < part.endMs).map((c) => ({ ...c, startMs: c.startMs - part.startMs }))
  const running = [...chapters].reverse().find((c) => c.startMs < part.startMs)
  if (running && (!inside.length || inside[0]!.startMs >= MIN_CHAPTER_GAP_MS)) inside.unshift({ startMs: 0, title: running.title })
  return inside
}

// ── Colours from the cover ──

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
const luminance = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255
const saturation = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

/**
 * Colours for the video from a picture's pixels (RGBA, as a canvas gives them): a dark background from its most
 * common colour, and a bright accent (for the waveform) from its most common lively colour — white when it has none.
 */
export function paletteFromPixels(data: ArrayLike<number>): { background: string; accent: string } {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 128) continue
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bucket.n++
    bucket.r += r
    bucket.g += g
    bucket.b += b
    buckets.set(key, bucket)
  }
  const colours = [...buckets.values()].map((x) => ({ n: x.n, r: x.r / x.n, g: x.g / x.n, b: x.b / x.n })).sort((a, b) => b.n - a.n)
  const base = colours[0]
  if (!base) return { background: '#111827', accent: '#ffffff' }
  // Dark enough for white text and a bright waveform on it.
  const k = Math.min(1, 0.18 / Math.max(0.01, luminance(base.r, base.g, base.b)))
  const background = hex(base.r * k, base.g * k, base.b * k)
  const lively = colours.find((c) => c.n >= colours[0]!.n * 0.02 && saturation(c.r, c.g, c.b) > 0.35 && luminance(c.r, c.g, c.b) > 0.25)
  if (!lively) return { background, accent: '#ffffff' }
  // Lifted towards white until it is clearly brighter than the background.
  let { r, g, b } = lively
  while (luminance(r, g, b) < 0.6) {
    r += (255 - r) * 0.2
    g += (255 - g) * 0.2
    b += (255 - b) * 0.2
  }
  return { background, accent: hex(r, g, b) }
}

// ── Highlight clip ──

export const HIGHLIGHT_LENGTHS = [30, 45, 60] as const

/** The highlight video's title: "… (highlight)", within the 200-character limit. */
export function highlightTitle(title: string): string {
  const suffix = ' (highlight)'
  return title.slice(0, 200 - suffix.length) + suffix
}

// ── Intro and outro cards (backend VideoEditRules cards; the text limit is the trim's, MAX_CARD_TEXT) ──

export const MIN_CARD_SECONDS = 1
export const MAX_CARD_SECONDS = 6

/** Why the cards can't be made, or null. Empty text = no card. */
export function cardsProblem(intro: { text: string; seconds: number }, outro: { text: string; seconds: number }): string | null {
  for (const [name, c] of [
    ['Intro', intro],
    ['Outro', outro]
  ] as const) {
    if (!c.text.trim()) continue
    if (c.text.length > MAX_CARD_TEXT) return `${name} card: at most ${MAX_CARD_TEXT} characters`
    if (c.seconds < MIN_CARD_SECONDS || c.seconds > MAX_CARD_SECONDS) return `${name} card: it lasts ${MIN_CARD_SECONDS}–${MAX_CARD_SECONDS} s`
  }
  return null
}

/** A card for the request, or undefined for none. */
export function cardRequest(c: { text: string; seconds: number }): { text: string; durationMs: number } | undefined {
  return c.text.trim() ? { text: c.text.trim(), durationMs: Math.round(c.seconds * 1000) } : undefined
}

/** Where a new chapter goes: 0:00 for the first, else a minute after the last (kept 5 s inside the recording). */
export function newChapterStart(chapters: ChapterMark[], durationMs: number | null): number {
  if (!chapters.length) return 0
  const after = Math.max(...chapters.map((c) => c.startMs)) + 60_000
  return durationMs ? Math.max(0, Math.min(after, durationMs - MIN_CHAPTER_GAP_MS)) : after
}

/** The highlight moved to start at `startMs`, keeping its length, kept inside a recording `totalMs` long (whole ms). */
export function moveRange(range: { startMs: number; endMs: number }, startMs: number, totalMs: number): { startMs: number; endMs: number } {
  const length = range.endMs - range.startMs
  const start = Math.round(Math.max(0, Math.min(startMs, totalMs - length)))
  return { startMs: start, endMs: start + length }
}

// ── A pasted chapter list ──

/** A time with at least one colon — "1:23", "01:02:03", "12:30.5" — so a line like "3 verbs" isn't read as one. */
const STAMP = String.raw`(\d{1,2}(?::\d{2}){1,2}(?:\.\d+)?)`
const STAMP_FIRST = new RegExp(String.raw`^[[(]?${STAMP}[\])]?\s*(?:[-–—:|.]\s*)?(.*)$`)
const STAMP_LAST = new RegExp(String.raw`^(.*?)\s*(?:[-–—:|]\s*)?[[(]?${STAMP}[\])]?$`)

function stampMs(stamp: string): number | null {
  const parts = stamp.split(':').map(Number)
  if (parts.slice(1).some((n) => n >= 60)) return null
  return Math.round(parts.reduce((total, n) => total * 60 + n, 0) * 1000)
}

/**
 * Chapters from a pasted list, one a line, as YouTube descriptions and show notes write them: "0:00 Intro",
 * "1:02:03 - Practice", "[12:30] Verbs", or with the time last ("Verbs (12:30)"); a leading bullet is fine. Lines
 * without both a time and a title are left out and counted. In time order, titles cut to MAX_CHAPTER_TITLE.
 */
export function parseChapterList(text: string): { chapters: ChapterMark[]; skipped: number } {
  const chapters: ChapterMark[] = []
  let skipped = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*•·]\s+)?/, '').trim()
    if (!line) continue
    const first = line.match(STAMP_FIRST)
    const last = first ? null : line.match(STAMP_LAST)
    const [stamp, title] = first ? [first[1]!, first[2]!] : last ? [last[2]!, last[1]!] : ['', '']
    const startMs = stamp ? stampMs(stamp) : null
    if (startMs === null || !title.trim()) {
      skipped++
      continue
    }
    chapters.push({ startMs, title: title.trim().slice(0, MAX_CHAPTER_TITLE) })
  }
  return { chapters: chapters.sort((a, b) => a.startMs - b.startMs), skipped }
}

// ── Putting a batch in order, and numbering its titles ──

export type RecordingOrder = 'TRACK' | 'NAME'

/**
 * The recordings in a new order: by the track number in their tags (disc first; ones without a number keep their
 * order after the numbered ones), or by file name as a person reads it ("Lesson 2" before "Lesson 10").
 */
export function orderRecordings<T extends { name: string; track: number | null; disc: number | null }>(items: T[], by: RecordingOrder): T[] {
  const names = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      if (by === 'NAME') return names.compare(a.item.name, b.item.name) || a.i - b.i
      const ta = a.item.track
      const tb = b.item.track
      if (ta === null || tb === null) return ta === tb ? a.i - b.i : ta === null ? 1 : -1
      return (a.item.disc ?? 1) - (b.item.disc ?? 1) || ta - tb || a.i - b.i
    })
    .map((x) => x.item)
}

export const TITLE_PATTERNS = ['{n}. {title}', 'Episode {n}: {title}', 'Lesson {nn} — {title}', '{title} (Part {n})'] as const

/** Why the numbering pattern can't be used, or null. */
export function titlePatternProblem(pattern: string): string | null {
  if (!/\{nn?\}/.test(pattern)) return 'Put {n} where the number goes'
  if (!pattern.includes('{title}') && !pattern.replace(/\{nn?\}/g, '').trim()) return 'Add some words or {title}'
  return null
}

/** A remembered "Number the titles" choice, or null when what was kept can't be used. */
export function sanitizeTitleNumbering(raw: unknown): { pattern: string; start: number } | null {
  if (!raw || typeof raw !== 'object') return null
  const { pattern, start } = raw as Record<string, unknown>
  if (typeof pattern !== 'string' || pattern.length > MAX_VIDEO_TITLE || titlePatternProblem(pattern)) return null
  const n = typeof start === 'number' && Number.isFinite(start) ? Math.max(0, Math.min(9999, Math.round(start))) : 1
  return { pattern, start: n }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A leading "01 ", "3. " or "12 - ", as file names numbered for sorting have. */
const LEADING_NUMBER = /^\d{1,3}(?:\s*[-–—.:)_]\s*|\s+)(?=\S)/

/**
 * The titles numbered from `start` with a pattern: {n} is the number, {nn} the number with leading zeros to the
 * widest one's width (at least 2), {title} the title. A number the pattern already put there (numbering again after
 * a reorder) is taken off first, and so is a leading number every title of several has (from "01 intro.mp3"), so none ends up
 * numbered twice. Each at most MAX_VIDEO_TITLE characters.
 */
export function numberTitles(titles: string[], pattern: string, start = 1): string[] {
  const width = Math.max(2, String(start + titles.length - 1).length)
  // What the pattern adds around the title, with any number in place of {n}.
  const [before = '', after = ''] = pattern.includes('{title}') ? pattern.split('{title}') : [pattern, '']
  const asRegExp = (part: string) => escapeRegExp(part).replace(/\\\{nn?\\\}/g, '\\d+')
  const own = new RegExp(`^${asRegExp(before)}([\\s\\S]*?)${asRegExp(after)}$`)
  const plain = titles.map((t) => {
    const m = before || after ? t.match(own) : null
    return (m && /\{nn?\}/.test(before + after) ? m[1]! : t).trim()
  })
  const allNumbered = plain.length > 1 && plain.every((t) => LEADING_NUMBER.test(t))
  return plain.map((t, i) => {
    const n = start + i
    const title = allNumbered ? t.replace(LEADING_NUMBER, '') : t
    return pattern
      .replace(/\{nn\}/g, String(n).padStart(width, '0'))
      .replace(/\{n\}/g, String(n))
      .replace(/\{title\}/g, title)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_VIDEO_TITLE)
  })
}

/**
 * Every title with `find` replaced (all of it, as written — not a pattern), case-blind unless `matchCase`; spaces
 * tidied, at most MAX_VIDEO_TITLE characters. `changed` counts the titles it changed.
 */
export function replaceInTitles(titles: string[], find: string, replace: string, matchCase = false): { titles: string[]; changed: number } {
  if (!find) return { titles, changed: 0 }
  const re = new RegExp(escapeRegExp(find), matchCase ? 'g' : 'gi')
  let changed = 0
  const out = titles.map((t) => {
    const next = t
      .replace(re, () => replace)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_VIDEO_TITLE)
    if (next !== t) changed++
    return next
  })
  return { titles: out, changed }
}

/**
 * For each title, the index of the first other title that reads the same (case and spacing aside), or null: such
 * videos would be hard to tell apart in a list. Empty titles are left out (they're reported as missing instead).
 */
export function titleTwins(titles: string[]): (number | null)[] {
  const keys = titles.map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase())
  return keys.map((k, i) => {
    if (!k) return null
    const j = keys.findIndex((other, at) => at !== i && other === k)
    return j === -1 ? null : j
  })
}
