// Bounds-checking for trim/crop/scale/split requests, mirroring the
// backend's VideoEditRules — used for inline validation and disabled-state
// before the API is even called. The backend is still the authority; these
// are the same rules, just closer to the form.

export interface Segment {
  startMs: number
  endMs: number | null
}

export const MAX_SEGMENTS = 20

/** Null = valid; a message otherwise. `durationMs` null = unknown, so only what can be checked without it is. */
export function validateTrim(startMs: number, endMs: number | null, durationMs: number | null): string | null {
  if (startMs < 0) return "The start can't be before the beginning"
  if (endMs != null && endMs <= startMs) return 'The end must be after the start'
  if (durationMs != null) {
    if (startMs >= durationMs) return 'The start is at or past the end of the video'
    if (endMs != null && endMs > durationMs) return 'The end is past the end of the video'
  }
  return null
}

/** Only called once a crop is actually requested — x/y/w/h are all given. */
export function validateCrop(x: number, y: number, w: number, h: number, videoWidth: number | null, videoHeight: number | null): string | null {
  if (w <= 0 || h <= 0) return 'Crop width and height must be positive'
  if (x < 0 || y < 0) return "Crop position can't be negative"
  if (videoWidth != null && x + w > videoWidth) return 'The crop extends past the right edge of the video'
  if (videoHeight != null && y + h > videoHeight) return 'The crop extends past the bottom edge of the video'
  return null
}

/** Only called once a resize is actually requested — w/h are both given. */
export function validateScale(w: number, h: number): string | null {
  return w <= 0 || h <= 0 ? 'The resized width and height must be positive' : null
}

export function validateSegments(segments: Segment[], durationMs: number | null): string | null {
  if (!segments.length) return 'Add at least one segment'
  if (segments.length > MAX_SEGMENTS) return `At most ${MAX_SEGMENTS} segments at a time`
  for (let i = 0; i < segments.length; i++) {
    const err = validateTrim(segments[i]!.startMs, segments[i]!.endMs, durationMs)
    if (err) return `Segment ${i + 1}: ${err}`
  }
  return null
}

// ── Editor helpers ───────────────────────────────────────────────────────────
// The arithmetic behind the trim and split tabs, kept out of the component so
// it can be tested. Trim ranges are in ms; the split tab's rows are in seconds
// (that is what its fields edit), with a null end meaning "to the end".

/** The smallest trim the slider allows between its two handles. */
export const MIN_TRIM_MS = 500

/** A row of the split tab. */
export interface SegmentRow {
  startMsSeconds: number
  endMsSeconds: number | null
}

/** Moves one edge of the trim range, keeping it inside the video and at least MIN_TRIM_MS long. */
export function withTrimEdge(range: [number, number], edge: 'start' | 'end', ms: number, durationMs: number): [number, number] {
  if (edge === 'start') return [Math.round(Math.min(Math.max(0, ms), range[1] - MIN_TRIM_MS)), range[1]]
  const max = Math.max(durationMs, MIN_TRIM_MS)
  return [range[0], Math.round(Math.max(Math.min(max, ms), range[0] + MIN_TRIM_MS))]
}

/** The row the playhead is strictly inside (by `margin` seconds each side), or null when no row can be cut there. */
export function findSplitTarget(rows: SegmentRow[], seconds: number, durationSeconds: number, margin = 0.1): number | null {
  const i = rows.findIndex((r) => seconds > r.startMsSeconds + margin && seconds < (r.endMsSeconds ?? durationSeconds) - margin)
  return i === -1 ? null : i
}

/** Cuts row `index` in two at `seconds` (rounded to hundredths). Returns a new list. */
export function splitRowAt(rows: SegmentRow[], index: number, seconds: number): SegmentRow[] {
  const row = rows[index]
  if (!row) return rows
  const t = Math.round(seconds * 100) / 100
  return [...rows.slice(0, index), { startMsSeconds: row.startMsSeconds, endMsSeconds: t }, { startMsSeconds: t, endMsSeconds: row.endMsSeconds }, ...rows.slice(index + 1)]
}

/** Milliseconds of the video that no row covers (gaps, or before the first / after the last). Overlaps count once. */
export function uncoveredMs(rows: SegmentRow[], durationMs: number): number {
  if (!durationMs) return 0
  const spans = rows
    .map((r) => [Math.max(0, r.startMsSeconds * 1000), Math.min(durationMs, (r.endMsSeconds ?? durationMs / 1000) * 1000)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])
  let covered = 0
  let cursor = 0
  for (const [a, b] of spans) {
    const from = Math.max(a, cursor)
    if (b > from) covered += b - from
    cursor = Math.max(cursor, b)
  }
  return Math.max(0, durationMs - covered)
}

// ── A new video from an edit's result ────────────────────────────────────────

export const MAX_VIDEO_TITLE = 200

export type ClipOperation = 'TRIM' | 'SPLIT' | 'AUDIO' | 'EXTRACT' | 'OVERLAY'

/** Whether applying this result would replace the video's own file (so a separate video is the alternative). */
export function replacesOriginal(operation: ClipOperation): boolean {
  return operation === 'TRIM' || operation === 'AUDIO' || operation === 'OVERLAY'
}

/**
 * The title suggested for a video made from a result: the original's, with what was done to it.
 * Mirrors the server's own default (VideoEditService.promotedTitle), so what is shown here is what
 * is saved when the field is left alone.
 */
export function suggestedNewTitle(sourceTitle: string | null | undefined, operation: ClipOperation, segmentIndex?: number | null): string {
  const suffix =
    operation === 'SPLIT'
      ? ` — Part ${(segmentIndex ?? 0) + 1}`
      : operation === 'TRIM'
        ? ' (trimmed)'
        : operation === 'AUDIO'
          ? ' (edited audio)'
          : operation === 'OVERLAY'
            ? ' (with text & overlays)'
            : ' (audio)'
  const base = (sourceTitle ?? '').trim() || 'Video'
  const room = MAX_VIDEO_TITLE - suffix.length
  return (base.length > room ? `${base.slice(0, Math.max(0, room - 1))}…` : base) + suffix
}
