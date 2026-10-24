// More ways to place the Split tab's cuts: at the video's markers, and moved out of
// the middle of a sentence to the nearest pause in the transcript. Rows are in
// seconds like the rest of the Split tab (a null end = "to the end"). Pure, so tested.
import { boundaryAfter, MAX_PART_LABEL, MAX_SEGMENTS, MIN_TRIM_MS, moveBoundary, type SegmentRow } from './videoEdit'
import type { TimedCue } from './sentences'
import { parseChapterList } from './audioVideoExtras'

/** How far (ms) a cut may move to reach a sentence break. */
export const MAX_SNAP_MS = 3000

/**
 * Rows covering the whole video, cut at the given times (ms). A time outside the video, or closer than
 * MIN_TRIM_MS to the cut before it or to the end, is skipped. `rows` is empty when fewer than two parts
 * come out, or more than MAX_SEGMENTS (`tooMany`).
 */
export function rowsFromCutPoints(durationMs: number, cutsMs: number[]): { rows: SegmentRow[]; skipped: number; tooMany: boolean } {
  const sorted = [...new Set(cutsMs.map((t) => Math.round(t / 10) * 10))].sort((a, b) => a - b)
  const kept: number[] = []
  let prev = 0
  for (const t of sorted) {
    if (t - prev < MIN_TRIM_MS || durationMs - t < MIN_TRIM_MS) continue
    kept.push(t)
    prev = t
  }
  const skipped = cutsMs.length - kept.length
  const tooMany = kept.length + 1 > MAX_SEGMENTS
  if (!kept.length || tooMany || !durationMs) return { rows: [], skipped, tooMany }
  const at = [0, ...kept]
  const rows = at.map((t, i) => ({ startMsSeconds: t / 1000, endMsSeconds: i === at.length - 1 ? null : at[i + 1]! / 1000 }))
  return { rows, skipped, tooMany }
}

/** The quiet stretches between sentences (ms), in order; touching sentences give a zero-length break. */
export function sentenceBreaks(cues: TimedCue[]): { fromMs: number; toMs: number }[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)
  const breaks: { fromMs: number; toMs: number }[] = []
  let spokenUntil = -Infinity
  for (let i = 0; i < sorted.length; i++) {
    const cue = sorted[i]!
    if (i > 0 && cue.startMs >= spokenUntil) breaks.push({ fromMs: spokenUntil, toMs: cue.startMs })
    spokenUntil = Math.max(spokenUntil, cue.endMs)
  }
  return breaks
}

/**
 * Moves each cut shared by two touching rows to the middle of the nearest sentence break within `maxShiftMs`,
 * keeping both neighbours at least MIN_TRIM_MS long. A cut already in a break stays. `unmoved` counts the cuts
 * left inside a sentence (no break near enough, or moving would make a part too short).
 */
export function snapCutsToBreaks(
  rows: SegmentRow[],
  breaks: { fromMs: number; toMs: number }[],
  durationMs: number,
  maxShiftMs = MAX_SNAP_MS
): { rows: SegmentRow[]; moved: number; unmoved: number } {
  let out = rows
  let moved = 0
  let unmoved = 0
  for (let i = 0; i < rows.length - 1; i++) {
    const at = boundaryAfter(out, i)
    if (at === null) continue
    const ms = Math.round(at * 1000)
    if (breaks.some((b) => ms >= b.fromMs && ms <= b.toMs)) continue
    const targets = breakMiddles(breaks)
      .filter((t) => Math.abs(t * 1000 - ms) <= maxShiftMs)
      .sort((a, b) => Math.abs(a * 1000 - ms) - Math.abs(b * 1000 - ms))
    const next = targets.map((t) => ({ t, rows: moveBoundary(out, i, t, durationMs) })).find((c) => boundaryAfter(c.rows, i) === c.t)
    if (next) {
      out = next.rows
      moved++
    } else unmoved++
  }
  return { rows: out, moved, unmoved }
}

/** Middles of the breaks (seconds, to hundredths). */
function breakMiddles(breaks: { fromMs: number; toMs: number }[]): number[] {
  return breaks.map((b) => Math.round((b.fromMs + b.toMs) / 20) / 100)
}

/**
 * Parts of about `targetMs` each, every cut at the sentence break nearest its mark (within a quarter of the
 * target either way; else at the mark). A last bit under a quarter of the target joins the part before.
 */
export function rowsNearLength(durationMs: number, targetMs: number, breaks: { fromMs: number; toMs: number }[]): { rows: SegmentRow[]; tooMany: boolean } {
  if (!(targetMs >= MIN_TRIM_MS) || !durationMs || targetMs >= durationMs) return { rows: [], tooMany: false }
  const middles = breakMiddles(breaks).map((s) => s * 1000)
  const slack = targetMs / 4
  const cuts: number[] = []
  let prev = 0
  while (durationMs - prev > targetMs + slack) {
    const mark = prev + targetMs
    const near = middles.filter((t) => Math.abs(t - mark) <= slack && t - prev >= MIN_TRIM_MS).sort((a, b) => Math.abs(a - mark) - Math.abs(b - mark))[0]
    const cut = near ?? mark
    cuts.push(cut)
    prev = cut
    if (cuts.length >= MAX_SEGMENTS) return { rows: [], tooMany: true }
  }
  const { rows, tooMany } = rowsFromCutPoints(durationMs, cuts)
  return { rows, tooMany }
}

/** Cut times (ms): the middle of each pause at least `minPauseMs` long; past MAX_SEGMENTS parts, only the longest pauses. */
export function cutsAtPauses(pauses: { startMs: number; endMs: number }[], minPauseMs: number): number[] {
  return pauses
    .filter((p) => p.endMs - p.startMs >= minPauseMs)
    .sort((a, b) => b.endMs - b.startMs - (a.endMs - a.startMs))
    .slice(0, MAX_SEGMENTS - 1)
    .map((p) => Math.round((p.startMs + p.endMs) / 2))
    .sort((a, b) => a - b)
}

/** What is said in a part: the sentences overlapping it, joined and cut to `maxChars`. */
export function segmentSpeech(cues: (TimedCue & { text: string })[], startMs: number, endMs: number, maxChars = 90): string {
  const text = cues
    .filter((c) => c.endMs > startMs && c.startMs < endMs)
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join(' ')
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text
}

/** Longest part each kind of upload takes (the platforms' own limits change; these are a guide). */
export const SEGMENT_LENGTH_LIMITS = [
  { label: '1 min', ms: 60_000 },
  { label: '3 min (Shorts, Reels)', ms: 180_000 },
  { label: '10 min (TikTok)', ms: 600_000 }
] as const

function rowEndMs(row: SegmentRow, durationMs: number): number {
  return row.endMsSeconds == null ? durationMs : Math.round(row.endMsSeconds * 1000)
}

/** Indexes of the rows longer than `limitMs`. */
export function rowsOverLimit(rows: SegmentRow[], limitMs: number, durationMs: number): number[] {
  return rows.flatMap((r, i) => (rowEndMs(r, durationMs) - Math.round(r.startMsSeconds * 1000) > limitMs ? [i] : []))
}

/** Each row longer than `limitMs` cut into the fewest equal parts that fit; empty `rows` when that makes more than MAX_SEGMENTS. */
export function splitLongRows(rows: SegmentRow[], limitMs: number, durationMs: number): { rows: SegmentRow[]; tooMany: boolean } {
  const out: SegmentRow[] = []
  for (const r of rows) {
    const start = Math.round(r.startMsSeconds * 1000)
    const len = rowEndMs(r, durationMs) - start
    const n = len > limitMs ? Math.ceil(len / limitMs) : 1
    const at = (i: number) => Math.round((start + (len * i) / n) / 10) / 100
    // The pieces keep the shape; the name stays with the first.
    for (let i = 0; i < n; i++)
      out.push({
        ...r,
        startMsSeconds: i === 0 ? r.startMsSeconds : at(i),
        endMsSeconds: i === n - 1 ? r.endMsSeconds : at(i + 1),
        label: i === 0 ? r.label : undefined
      })
  }
  return out.length > MAX_SEGMENTS ? { rows: [], tooMany: true } : { rows: out, tooMany: false }
}

/**
 * Pulls each row's start and end in to its first and last sentence (keeping `padMs` of quiet), so no part
 * opens or ends on dead air. A row with no speech, or that would get shorter than MIN_TRIM_MS, stays.
 */
export function tightenToSpeech(rows: SegmentRow[], cues: TimedCue[], durationMs: number, padMs = 250): { rows: SegmentRow[]; changed: number } {
  let changed = 0
  const out = rows.map((r) => {
    const start = Math.round(r.startMsSeconds * 1000)
    const end = rowEndMs(r, durationMs)
    const inside = cues.filter((c) => c.endMs > start && c.startMs < end)
    if (!inside.length) return r
    const from = Math.max(start, Math.min(...inside.map((c) => c.startMs)) - padMs)
    const to = Math.min(end, Math.max(...inside.map((c) => c.endMs)) + padMs)
    if (to - from < MIN_TRIM_MS || (from === start && to === end)) return r
    changed++
    return { ...r, startMsSeconds: Math.round(from / 10) / 100, endMsSeconds: to >= durationMs && r.endMsSeconds == null ? null : Math.round(to / 10) / 100 }
  })
  return { rows: out, changed }
}

/** Within this of a marker, a cut is taken to be marked already. */
export const SAME_MARKER_MS = 100

/** Markers for the rows' cuts ("Part 2" where a part starts, "Part 1 ends" where one ends before a gap), leaving out ones already marked. */
export function cutMarkers(rows: SegmentRow[], existing: { atMs: number }[], durationMs: number): { atMs: number; label: string }[] {
  const out: { atMs: number; label: string }[] = []
  const add = (atMs: number, label: string) => {
    if (atMs <= 0 || atMs >= durationMs) return
    if ([...existing, ...out].some((m) => Math.abs(m.atMs - atMs) < SAME_MARKER_MS)) return
    out.push({ atMs, label })
  }
  rows.forEach((r, i) => {
    add(Math.round(r.startMsSeconds * 1000), `Part ${i + 1}`)
    if (boundaryAfter(rows, i) === null) add(rowEndMs(r, durationMs), `Part ${i + 1} ends`)
  })
  return out.sort((a, b) => a.atMs - b.atMs)
}

/** The trim range with each edge that sits inside a sentence moved to the nearest break within `maxShiftMs`, keeping it at least MIN_TRIM_MS long. */
export function snapRangeToBreaks(
  range: [number, number],
  breaks: { fromMs: number; toMs: number }[],
  durationMs: number,
  maxShiftMs = MAX_SNAP_MS
): { range: [number, number]; moved: number } {
  const middles = breakMiddles(breaks).map((s) => Math.round(s * 1000))
  const inBreak = (ms: number) => ms <= 0 || ms >= durationMs || breaks.some((b) => ms >= b.fromMs && ms <= b.toMs)
  const nearest = (ms: number, ok: (t: number) => boolean) =>
    middles.filter((t) => Math.abs(t - ms) <= maxShiftMs && ok(t)).sort((a, b) => Math.abs(a - ms) - Math.abs(b - ms))[0]
  let [start, end] = range
  let moved = 0
  if (!inBreak(start)) {
    const t = nearest(start, (t) => end - t >= MIN_TRIM_MS)
    if (t !== undefined) [start, moved] = [t, moved + 1]
  }
  if (!inBreak(end)) {
    const t = nearest(end, (t) => t - start >= MIN_TRIM_MS)
    if (t !== undefined) [end, moved] = [t, moved + 1]
  }
  return { range: [start, end], moved }
}

/** Names the rows after the marks (markers, chapters) where they start: a row starting within SAME_MARKER_MS of one takes its label. */
export function labelRowsAt(rows: SegmentRow[], marks: { atMs: number; label: string }[]): SegmentRow[] {
  return rows.map((r) => {
    const mark = marks.find((m) => Math.abs(m.atMs - r.startMsSeconds * 1000) < SAME_MARKER_MS && m.label.trim())
    return mark ? { ...r, label: mark.label.trim().slice(0, MAX_PART_LABEL) } : r
  })
}

/** The shapes a split part can be cropped to (w/h); 0 = the video's own. */
export const PART_SHAPES = [
  { label: 'Same as video', value: 0 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 }
] as const

/** The split request's parts: name and shape only when set. */
export function splitRequestSegments(rows: SegmentRow[]): { startMs: number; endMs: number | null; label?: string; aspect?: number }[] {
  return rows.map((r) => ({
    startMs: Math.round(r.startMsSeconds * 1000),
    endMs: r.endMsSeconds == null ? null : Math.round(r.endMsSeconds * 1000),
    ...(r.label?.trim() ? { label: r.label.trim().slice(0, MAX_PART_LABEL) } : {}),
    ...(r.aspect ? { aspect: r.aspect } : {})
  }))
}

// ── A pasted list, the parts as a list, and names from the speech ──

/**
 * Rows cut at the times of a pasted "0:00 Intro" list (as parseChapterList reads it), each named after its line.
 * `lines` counts the lines with no time; `skipped` the times too close to another cut or an end, as rowsFromCutPoints.
 */
export function rowsFromList(text: string, durationMs: number): { rows: SegmentRow[]; found: number; lines: number; skipped: number; tooMany: boolean } {
  const { chapters, skipped: lines } = parseChapterList(text)
  // A list starting at 0:00 has no cut there; its first title names the first part.
  const { rows, skipped, tooMany } = rowsFromCutPoints(
    durationMs,
    chapters.filter((c) => c.startMs > 0).map((c) => c.startMs)
  )
  const marks = chapters.map((c) => ({ atMs: c.startMs, label: c.title }))
  return { rows: labelRowsAt(rows, marks), found: chapters.length, lines, skipped, tooMany }
}

function listStamp(ms: number, hours: boolean): string {
  const s = Math.floor(ms / 1000)
  const two = (n: number) => String(n).padStart(2, '0')
  return hours ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`
}

/** The parts as "0:00 Name" lines, in row order (a part without a name is "Part N"), for a description or show notes. */
export function partsAsList(rows: SegmentRow[], durationMs: number): string {
  const hours = durationMs >= 3_600_000
  return rows.map((r, i) => `${listStamp(r.startMsSeconds * 1000, hours)} ${r.label?.trim() || `Part ${i + 1}`}`).join('\n')
}

/** A part's name from what it says: its first few words (to a sentence's end, if sooner), capitalised, without the closing punctuation. */
export function labelFromSpeech(text: string, maxWords = 6): string {
  const sentence = text.replace(/…$/, '').split(/(?<=[.!?។])\s/)[0]!
  const words = sentence.trim().split(/\s+/).filter(Boolean).slice(0, maxWords)
  const label = words
    .join(' ')
    .replace(/[\s.,;:!?។…"“”'‘’-]+$/u, '')
    .slice(0, MAX_PART_LABEL)
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : ''
}
