// Video from audio, the later options: chapters (from the file's own tags, shown on the picture and kept as
// chapter markers), colours taken from the cover, the highlight clip's title, and intro/outro cards. Mirrors the
// backend (AudioToVideoRules chapters, VideoEditRules cards), which re-checks everything.
import { MAX_CARD_TEXT } from './trimExtras'

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
