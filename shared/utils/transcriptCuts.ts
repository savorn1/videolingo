// Cutting a video where its spoken lines (transcript segments) start and end, so
// a split or a trim doesn't land in the middle of a word. Pure, so it's tested.

import { MAX_SEGMENTS, MIN_TRIM_MS, type SegmentRow } from './videoEdit'
import { MAX_CUTS, MIN_CUT_MS, MIN_KEPT_MS, validateCutOut, type CutRange } from './cutOut'

export interface SpokenLine {
  startMs: number
  endMs: number
}

/** Room left around a line when a trim is fitted to it, so its first and last sounds aren't clipped. */
export const LINE_PAD_MS = 150

/** The transcript to cut by: one in the video's own spoken language, else the first; null when there is none. */
export function pickTranscript<T extends { id: number; language: string }>(transcripts: T[], videoLanguage: string | null | undefined): T | null {
  return transcripts.find((t) => !!videoLanguage && t.language === videoLanguage) ?? transcripts[0] ?? null
}

function cleanLines(lines: SpokenLine[], durationMs: number): SpokenLine[] {
  return lines
    .filter((l) => Number.isFinite(l.startMs) && Number.isFinite(l.endMs) && l.endMs > l.startMs && l.startMs < durationMs)
    .map((l) => ({ startMs: Math.max(0, l.startMs), endMs: Math.min(durationMs, l.endMs) }))
    .sort((a, b) => a.startMs - b.startMs)
}

/**
 * Split rows that cut the video in the pauses between lines: one per line, or the lines grouped evenly
 * (by count) when there are more than `maxParts`. The rows touch, cover the whole video and are each at
 * least MIN_TRIM_MS long (a cut that would make one shorter is skipped). Empty when no cut is possible.
 */
export function sentenceSplitRows(lines: SpokenLine[], durationMs: number, maxParts = MAX_SEGMENTS): SegmentRow[] {
  const clean = cleanLines(lines, durationMs)
  const parts = Math.min(clean.length, maxParts, MAX_SEGMENTS)
  if (parts < 2 || !durationMs) return []
  const cuts: number[] = []
  for (let g = 1; g < parts; g++) {
    const first = Math.floor((g * clean.length) / parts)
    const before = clean[first - 1]!
    const after = clean[first]!
    // Midway through the pause (or the overlap) between the two lines.
    const at = (Math.min(before.endMs, after.startMs) + Math.max(before.endMs, after.startMs)) / 2
    const previous = cuts.at(-1) ?? 0
    if (at - previous >= MIN_TRIM_MS && durationMs - at >= MIN_TRIM_MS) cuts.push(at)
  }
  if (!cuts.length) return []
  const sec = (ms: number) => Math.round(ms / 10) / 100
  return [0, ...cuts].map((start, i) => ({ startMsSeconds: sec(start), endMsSeconds: i < cuts.length ? sec(cuts[i]!) : null }))
}

/**
 * Widens a trim range so neither edge cuts through a line: an edge inside a line moves out to that line's
 * start (or end), with up to LINE_PAD_MS of room — less when the next line is closer — kept inside the
 * video. Edges in a pause stay where they are, so fitting twice changes nothing.
 */
export function fitRangeToLines(range: [number, number], lines: SpokenLine[], durationMs: number): [number, number] {
  const clean = cleanLines(lines, durationMs)
  const [s, e] = range
  const startLine = clean.find((l) => s > l.startMs && s < l.endMs)
  const endLine = clean.find((l) => e > l.startMs && e < l.endMs)
  // The room never reaches into the line before (or after), so the new edge sits in the pause between them.
  const prevEnd = startLine ? Math.max(0, ...clean.filter((l) => l.endMs <= startLine.startMs).map((l) => l.endMs)) : 0
  const nextStart = endLine ? Math.min(Math.max(durationMs, e), ...clean.filter((l) => l.startMs >= endLine.endMs).map((l) => l.startMs)) : 0
  const start = startLine ? Math.max(prevEnd, startLine.startMs - LINE_PAD_MS) : s
  const end = endLine ? Math.min(nextStart, endLine.endMs + LINE_PAD_MS) : e
  return [Math.round(start), Math.round(end)]
}

/** Room left around speech when pauses are cut out, so words aren't clipped. */
export const PAUSE_KEEP_MS = 200

/** The pause lengths offered for "Remove pauses longer than …". */
export const PAUSE_CHOICES = [700, 1000, 1500, 2000]

/**
 * Cut-out ranges that take out the pauses between spoken lines (and before the first / after the last)
 * longer than `minPauseMs`, leaving PAUSE_KEEP_MS of room next to speech. Speech is never cut. The result
 * always passes validateCutOut: at most MAX_CUTS (the longest pauses win), no cut under MIN_CUT_MS, and no
 * piece left between cuts under MIN_KEPT_MS (a cut that would leave one is skipped). Empty when there is
 * nothing to take out.
 */
export function pauseCuts(lines: SpokenLine[], durationMs: number, minPauseMs: number): CutRange[] {
  const clean = cleanLines(lines, durationMs)
  if (!clean.length || !durationMs) return []
  // Speech as non-overlapping spans.
  const spans: SpokenLine[] = []
  for (const l of clean) {
    const last = spans.at(-1)
    if (last && l.startMs <= last.endMs) last.endMs = Math.max(last.endMs, l.endMs)
    else spans.push({ ...l })
  }
  const candidates: CutRange[] = []
  const consider = (gapStart: number, gapEnd: number, start: number, end: number) => {
    if (gapEnd - gapStart >= minPauseMs && end - start >= MIN_CUT_MS) candidates.push({ startMs: Math.round(start), endMs: Math.round(end) })
  }
  consider(0, spans[0]!.startMs, 0, spans[0]!.startMs - PAUSE_KEEP_MS)
  for (let i = 1; i < spans.length; i++) {
    const gapStart = spans[i - 1]!.endMs
    const gapEnd = spans[i]!.startMs
    consider(gapStart, gapEnd, gapStart + PAUSE_KEEP_MS, gapEnd - PAUSE_KEEP_MS)
  }
  const lastEnd = spans.at(-1)!.endMs
  consider(lastEnd, durationMs, lastEnd + PAUSE_KEEP_MS, durationMs)

  const longest = [...candidates]
    .sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))
    .slice(0, MAX_CUTS)
    .sort((a, b) => a.startMs - b.startMs)
  const cuts: CutRange[] = []
  let keptFrom = 0
  for (const c of longest) {
    const piece = c.startMs - keptFrom
    if (piece > 0 && piece < MIN_KEPT_MS) continue
    cuts.push(c)
    keptFrom = c.endMs
  }
  const tail = durationMs - keptFrom
  if (cuts.length && tail > 0 && tail < MIN_KEPT_MS) cuts.pop()
  return validateCutOut(cuts, durationMs) ? [] : cuts
}

/**
 * A title for a clip cut from `startMs`–`endMs`: the source's title with what is said in it, e.g.
 * 'Lesson 3 — "How are you today?"'. The words come from the lines mostly inside the clip; long ones are
 * cut short. Null when no line falls inside (use the usual title then). Capped at 200 characters.
 */
export function spokenTitle(
  sourceTitle: string | null | undefined,
  lines: (SpokenLine & { text?: string | null })[],
  startMs: number,
  endMs: number
): string | null {
  const said = lines
    .filter((l) => l.text?.trim() && Math.min(endMs, l.endMs) - Math.max(startMs, l.startMs) >= (l.endMs - l.startMs) / 2)
    .map((l) => l.text!.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
  if (!said) return null
  const words = said.length > 60 ? `${said.slice(0, 59).trimEnd()}…` : said
  const base = (sourceTitle ?? '').trim() || 'Video'
  const suffix = ` — “${words}”`
  const room = 200 - suffix.length
  return (base.length > room ? `${base.slice(0, Math.max(0, room - 1))}…` : base) + suffix
}
