// Subtitle/transcript text helpers: parsing SRT / WebVTT / plain text into
// timed segments (for import), timestamp parsing and formatting (for the
// segment editor), and search highlighting. Pure and framework-free so the
// many edge cases in real subtitle files can be tested directly.

export interface TimedSegment {
  startMs: number
  endMs: number
  text: string
  speaker?: string | null
}

export type SubtitleFormat = 'vtt' | 'srt' | 'text'

export interface ParsedSubtitles {
  format: SubtitleFormat
  segments: TimedSegment[]
  /** Human-readable notes about anything skipped or guessed. */
  warnings: string[]
}

/** Seconds each line gets when importing plain text with no timings. */
export const PLACEHOLDER_SEGMENT_MS = 3000

// "01:02:03,456" / "01:02:03.456" / "02:03.456" / "2:03" / "62.5" / "62"
const TIMESTAMP = /^(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2}(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,3})?)$/

/**
 * Parses a human- or file-style timestamp into milliseconds. Accepts
 * h:mm:ss.mmm, mm:ss.mmm, m:ss, plain seconds ("62.5"), and a comma as the
 * decimal separator (SRT style). Returns null for anything else.
 */
export function parseTimestamp(input: string): number | null {
  const value = input.trim()
  if (!value) return null
  const match = TIMESTAMP.exec(value)
  if (!match) return null
  const parts = value.split(':')
  const secondsPart = parts.pop()!.replace(',', '.')
  const seconds = Number(secondsPart)
  const minutes = parts.length ? Number(parts.pop()) : 0
  const hours = parts.length ? Number(parts.pop()) : 0
  // With a minutes (or hours) part present, seconds/minutes must be < 60.
  if (value.includes(':') && seconds >= 60) return null
  if (hours && minutes >= 60) return null
  if (![seconds, minutes, hours].every(Number.isFinite)) return null
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000)
}

/** Editor-friendly timestamp: "1:02.500", or "1:02:03.456" past an hour. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const f = total % 1000
  const tail = `${String(s).padStart(2, '0')}.${String(f).padStart(3, '0')}`
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${tail}` : `${m}:${tail}`
}

const CUE_TIMING = /^\s*(\S+)\s+-->\s+(\S+)/

// Strips WebVTT/SRT inline markup (<i>, <b>, <c.yellow>, <00:01.000>, {\an8})
// but pulls a leading <v Speaker> voice tag out as the speaker.
function cleanCueText(raw: string): { text: string; speaker: string | null } {
  let speaker: string | null = null
  const voice = /^<v(?:\.[^\s>]+)?\s+([^>]+)>/.exec(raw)
  if (voice) speaker = voice[1]!.trim()
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
  return { text, speaker }
}

/**
 * Parses subtitle file content. WebVTT is detected by its header, SRT (or a
 * header-less VTT) by the presence of "-->" timing lines; anything else is
 * treated as plain text, one segment per non-empty line with placeholder
 * timings. Broken cues are skipped with a warning rather than failing the
 * whole import.
 */
export function parseSubtitles(content: string): ParsedSubtitles {
  const normalized = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const warnings: string[] = []

  const isVtt = /^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(normalized)
  if (!isVtt && !normalized.includes('-->')) {
    const lines = normalized
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length)
      warnings.push(`No timings found — each line was given a ${PLACEHOLDER_SEGMENT_MS / 1000}-second placeholder slot. Adjust them in the editor.`)
    return {
      format: 'text',
      segments: lines.map((text, i) => ({ startMs: i * PLACEHOLDER_SEGMENT_MS, endMs: (i + 1) * PLACEHOLDER_SEGMENT_MS, text })),
      warnings
    }
  }

  const segments: TimedSegment[] = []
  const blocks = normalized.split(/\n{2,}/)
  let cueNumber = 0
  for (const block of blocks) {
    const lines = block.split('\n')
    // VTT header, NOTE comments, STYLE and REGION blocks carry no cues.
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(lines[0]!.trim())) continue
    const timingIndex = lines.findIndex((l) => CUE_TIMING.test(l))
    if (timingIndex === -1) continue
    cueNumber++
    const timing = CUE_TIMING.exec(lines[timingIndex]!)!
    const startMs = parseTimestamp(timing[1]!)
    const endMs = parseTimestamp(timing[2]!)
    const { text, speaker } = cleanCueText(lines.slice(timingIndex + 1).join('\n'))
    if (startMs === null || endMs === null) {
      warnings.push(`Cue ${cueNumber} skipped: unreadable timing "${lines[timingIndex]!.trim()}".`)
      continue
    }
    if (endMs <= startMs) {
      warnings.push(`Cue ${cueNumber} skipped: it ends before it starts.`)
      continue
    }
    if (!text) {
      warnings.push(`Cue ${cueNumber} skipped: no text.`)
      continue
    }
    segments.push({ startMs, endMs, text, ...(speaker ? { speaker } : {}) })
  }
  segments.sort((a, b) => a.startMs - b.startMs)
  return { format: isVtt ? 'vtt' : 'srt', segments, warnings }
}

/**
 * Problems with one segment in the editor, or null if it's fine. Mirrors the
 * backend's checks so errors show next to the row instead of after saving.
 */
export function segmentError(segment: { startMs: number | null; endMs: number | null; text: string }): string | null {
  if (segment.startMs === null) return 'Start time is not a valid timestamp'
  if (segment.endMs === null) return 'End time is not a valid timestamp'
  if (segment.endMs <= segment.startMs) return 'End must be after start'
  if (!segment.text.trim()) return 'Text is empty'
  if (segment.text.length > 2000) return 'Text is longer than 2000 characters'
  return null
}

/**
 * Splits text into plain and matching parts for highlighting, case-insensitive.
 * Returned as data (not HTML) so the template can render it without v-html.
 */
export function splitHighlight(text: string, term: string): { text: string; match: boolean }[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return [{ text, match: false }]
  const parts: { text: string; match: boolean }[] = []
  const haystack = text.toLowerCase()
  let from = 0
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false })
    parts.push({ text: text.slice(at, at + needle.length), match: true })
    from = at + needle.length
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return parts
}
