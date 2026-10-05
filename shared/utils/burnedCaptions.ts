// Subtitles burned in from a transcript (the Text tab's "Subtitles" group). The
// backend renders them (OverlayRules.Captions + CaptionRules, an ASS file) and
// re-checks them; these mirror its rules and pair a second transcript (a
// translation) with the first the same way, for the live preview.

export type CaptionStyle = 'CLASSIC' | 'BOX' | 'YELLOW'
export type CaptionPosition = 'BOTTOM' | 'TOP'

export interface CaptionSettings {
  transcriptId: number | null
  /** A second transcript (a translation) shown smaller under each line; null for none. */
  secondTranscriptId: number | null
  style: CaptionStyle
  position: CaptionPosition
  /** Font size as % of the video's height. */
  sizePct: number
}

export const MIN_CAPTION_PCT = 3
export const MAX_CAPTION_PCT = 10

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: 'CLASSIC', label: 'White, outlined' },
  { value: 'BOX', label: 'On a dark box' },
  { value: 'YELLOW', label: 'Yellow, outlined' }
]

export const DEFAULT_CAPTIONS: CaptionSettings = { transcriptId: null, secondTranscriptId: null, style: 'CLASSIC', position: 'BOTTOM', sizePct: 5 }

/** Null = fine (or subtitles are off). */
export function validateCaptions(c: CaptionSettings | null): string | null {
  if (!c) return null
  if (c.transcriptId == null) return 'Subtitles: pick a transcript'
  if (c.secondTranscriptId != null && c.secondTranscriptId === c.transcriptId) return 'Subtitles: the second line needs a different transcript'
  if (!(c.sizePct >= MIN_CAPTION_PCT && c.sizePct <= MAX_CAPTION_PCT)) return `Subtitles: the size must be between ${MIN_CAPTION_PCT}% and ${MAX_CAPTION_PCT}%`
  return null
}

/** The `captions` part of the overlay request: null when subtitles are off. */
export function captionRequest(c: CaptionSettings | null): CaptionSettings | null {
  return c ? { ...c } : null
}

export interface CaptionLine {
  startMs: number
  endMs: number
  text: string
}

/** The second transcript's text for one line: the lines mostly inside it, else the most overlapping one (as the server pairs them). */
export function pairedSecond(line: CaptionLine, second: CaptionLine[]): string | null {
  const inside: string[] = []
  let best: CaptionLine | null = null
  let bestOverlap = 0
  for (const b of second) {
    if (!b.text?.trim()) continue
    const overlap = Math.min(line.endMs, b.endMs) - Math.max(line.startMs, b.startMs)
    if (overlap <= 0) continue
    if (overlap * 2 >= b.endMs - b.startMs) inside.push(b.text.trim())
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = b
    }
  }
  return inside.length ? inside.join(' ') : (best?.text.trim() ?? null)
}

/** What the subtitles show at `ms`, for the preview; null between lines. */
export function captionAt(first: CaptionLine[], second: CaptionLine[], ms: number): { text: string; second: string | null } | null {
  const line = first.find((l) => ms >= l.startMs && ms < l.endMs && l.text?.trim())
  return line ? { text: line.text.trim(), second: second.length ? pairedSecond(line, second) : null } : null
}
