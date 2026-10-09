// Bounds-checking for trim/crop/scale/split requests, mirroring the
// backend's VideoEditRules — used for inline validation and disabled-state
// before the API is even called. The backend is still the authority; these
// are the same rules, just closer to the form.

export interface Segment {
  startMs: number
  endMs: number | null
}

export const MAX_SEGMENTS = 20

/** How many of one video's edits the server lets be queued or running at once (VideoEditService.MAX_QUEUED_EDITS_PER_VIDEO); they still run one at a time. */
export const MAX_QUEUED_EDITS = 3

/** How far past the end of the video a trim may run when extended (VideoEditRules.MAX_EXTEND_MS): the last frame is held and the sound is silent. */
export const MAX_EXTEND_MS = 300_000

/** The latest time a trim's end can be set to. */
export function trimLimitMs(durationMs: number, extend: boolean): number {
  return durationMs + (extend ? MAX_EXTEND_MS : 0)
}

/** How much of a trim's range is past the end of the video (0 when it isn't). */
export function extensionMs(endMs: number | null, durationMs: number): number {
  return endMs != null && durationMs > 0 ? Math.max(0, Math.round(endMs - durationMs)) : 0
}

/** Null = valid; a message otherwise. `durationMs` null = unknown, so only what can be checked without it is. With `extend`, the end may run up to MAX_EXTEND_MS past the video. */
export function validateTrim(startMs: number, endMs: number | null, durationMs: number | null, extend = false): string | null {
  if (startMs < 0) return "The start can't be before the beginning"
  if (endMs != null && endMs <= startMs) return 'The end must be after the start'
  if (durationMs != null) {
    if (startMs >= durationMs) return 'The start is at or past the end of the video'
    if (endMs != null && endMs > durationMs) {
      if (!extend) return 'The end is past the end of the video'
      if (endMs - durationMs > MAX_EXTEND_MS) return `The end can be at most ${MAX_EXTEND_MS / 1000} s past the end of the video`
    }
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
  return [
    ...rows.slice(0, index),
    { startMsSeconds: row.startMsSeconds, endMsSeconds: t },
    { startMsSeconds: t, endMsSeconds: row.endMsSeconds },
    ...rows.slice(index + 1)
  ]
}

/** The most equal parts a video can be cut into: each at least MIN_TRIM_MS long, and no more than MAX_SEGMENTS. */
export function maxEvenParts(durationMs: number): number {
  if (!durationMs || durationMs <= 0) return 0
  return Math.max(1, Math.min(MAX_SEGMENTS, Math.floor(durationMs / MIN_TRIM_MS)))
}

/** `n` equal rows covering the whole video (boundaries rounded to hundredths; the last runs to the end). Empty when `n` isn't possible. */
export function splitEvenlyRows(durationMs: number, n: number): SegmentRow[] {
  if (!Number.isInteger(n) || n < 1 || n > maxEvenParts(durationMs)) return []
  const step = durationMs / 1000 / n
  const at = (i: number) => Math.round(i * step * 100) / 100
  return Array.from({ length: n }, (_, i) => ({ startMsSeconds: at(i), endMsSeconds: i === n - 1 ? null : at(i + 1) }))
}

/** Rows of `stepSeconds` each from the start, the last one taking what is left (a remainder under MIN_TRIM_MS is folded into the one before). Empty when it can't be done. */
export function splitEveryRows(durationMs: number, stepSeconds: number): SegmentRow[] {
  if (!(stepSeconds > 0) || !durationMs || stepSeconds * 1000 < MIN_TRIM_MS || stepSeconds * 1000 >= durationMs) return []
  const count = Math.floor(durationMs / (stepSeconds * 1000)) + (durationMs % (stepSeconds * 1000) >= MIN_TRIM_MS ? 1 : 0)
  if (count > MAX_SEGMENTS) return []
  const at = (i: number) => Math.round(i * stepSeconds * 100) / 100
  return Array.from({ length: count }, (_, i) => ({ startMsSeconds: at(i), endMsSeconds: i === count - 1 ? null : at(i + 1) }))
}

/** Where the boundary between row `index` and the next one sits, if they touch (so it can be dragged); otherwise null. */
export function boundaryAfter(rows: SegmentRow[], index: number): number | null {
  const a = rows[index]
  const b = rows[index + 1]
  return a && b && a.endMsSeconds != null && a.endMsSeconds === b.startMsSeconds ? a.endMsSeconds : null
}

/** Moves the shared boundary between row `index` and the next, keeping both at least MIN_TRIM_MS long. Returns a new list. */
export function moveBoundary(rows: SegmentRow[], index: number, seconds: number, durationMs: number): SegmentRow[] {
  if (boundaryAfter(rows, index) === null) return rows
  const a = rows[index]!
  const b = rows[index + 1]!
  const min = MIN_TRIM_MS / 1000
  const lo = a.startMsSeconds + min
  const hi = (b.endMsSeconds ?? durationMs / 1000) - min
  if (hi < lo) return rows
  const t = Math.round(Math.min(hi, Math.max(lo, seconds)) * 100) / 100
  return rows.map((r, i) => (i === index ? { ...r, endMsSeconds: t } : i === index + 1 ? { ...r, startMsSeconds: t } : r))
}

/** The largest `aspect`-shaped box that fits the frame, centred on (cx, cy) — the frame's centre by default. Whole pixels; empty (all zeros) when the frame size is unknown. */
export function centeredCrop(aspect: number, frameW: number, frameH: number, cx = frameW / 2, cy = frameH / 2): { x: number; y: number; w: number; h: number } {
  if (!(aspect > 0) || !frameW || !frameH) return { x: 0, y: 0, w: 0, h: 0 }
  let w = frameW
  let h = w / aspect
  if (h > frameH) {
    h = frameH
    w = h * aspect
  }
  const x = Math.min(Math.max(cx - w / 2, 0), frameW - w)
  const y = Math.min(Math.max(cy - h / 2, 0), frameH - h)
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
}

// ── Turning and flipping ─────────────────────────────────────────────────────
// Mirrors VideoEditRules (backend): quarter turns clockwise, then flips. The crop is
// still drawn on the picture as it is now; the turn and flips apply after the crop,
// and a resize is the size of the finished picture.

export type Rotation = 0 | 90 | 180 | 270
export interface Orientation {
  rotate: Rotation
  flipH: boolean
  flipV: boolean
}

export const NO_ORIENTATION: Orientation = { rotate: 0, flipH: false, flipV: false }

export function hasOrientation(o: Orientation): boolean {
  return o.rotate !== 0 || o.flipH || o.flipV
}

/** A quarter turn clockwise (`1`) or counter-clockwise (`-1`). */
export function turned(o: Orientation, direction: 1 | -1): Orientation {
  return { ...o, rotate: ((((o.rotate + direction * 90) % 360) + 360) % 360) as Rotation }
}

/** Whether the picture's width and height trade places. */
export function swapsSides(o: Orientation): boolean {
  return o.rotate === 90 || o.rotate === 270
}

// ── Resizing ─────────────────────────────────────────────────────────────────
// A resize is the size of the finished picture: after the crop and the turn.

/** The picture a resize starts from: the crop (or the whole frame), with its sides traded by a quarter turn. */
export function pictureBeforeResize(frameW: number, frameH: number, crop: { w: number; h: number } | null, o: Orientation): { w: number; h: number } | null {
  const w = crop?.w || frameW
  const h = crop?.h || frameH
  if (!w || !h) return null
  return swapsSides(o) ? { w: h, h: w } : { w, h }
}

/** Rounded to a whole, even number of pixels (video encoders want even sides), at least 2. */
function evenPx(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2)
}

/** The usual sizes, named by the short side as video sizes are ("1080p" is 1920×1080 wide or 1080×1920 tall). */
export const RESIZE_HEIGHTS = [
  { label: '480p', short: 480 },
  { label: '720p', short: 720 },
  { label: '1080p', short: 1080 },
  { label: '1440p', short: 1440 },
  { label: '4K', short: 2160 }
] as const

/** Each usual size in the picture's own shape. */
export function resizeChoices(picture: { w: number; h: number }): { label: string; w: number; h: number }[] {
  const tall = picture.h > picture.w
  return RESIZE_HEIGHTS.map(({ label, short }) => {
    const long = (short * Math.max(picture.w, picture.h)) / Math.min(picture.w, picture.h)
    return tall ? { label, w: evenPx(short), h: evenPx(long) } : { label, w: evenPx(long), h: evenPx(short) }
  })
}

/** The other side, when one is typed with "Keep shape" on. */
export function keepShapeSize(side: 'w' | 'h', value: number, picture: { w: number; h: number }): { w: number; h: number } {
  if (!(value > 0)) return side === 'w' ? { w: value, h: 0 } : { w: 0, h: value }
  return side === 'w' ? { w: value, h: evenPx((value * picture.h) / picture.w) } : { w: evenPx((value * picture.w) / picture.h), h: value }
}

/** What to say about a resize: larger than the picture (no sharper), or a different shape (stretched; more than 1 % off). */
export function resizeNotes(size: { w: number; h: number }, picture: { w: number; h: number }): { larger: boolean; stretched: boolean } {
  if (!(size.w > 0 && size.h > 0)) return { larger: false, stretched: false }
  const larger = size.w > picture.w || size.h > picture.h
  const stretched = Math.abs(size.w / size.h / (picture.w / picture.h) - 1) > 0.01
  return { larger, stretched }
}

/** The picture's size after the turn: a quarter turn swaps width and height. */
export function orientedSize(w: number, h: number, o: Orientation): { w: number; h: number } {
  return swapsSides(o) ? { w: h, h: w } : { w, h }
}

/** "Turned 90° clockwise · flipped left–right", or '' when nothing is asked for. */
export function describeOrientation(o: Orientation): string {
  const parts: string[] = []
  if (o.rotate) parts.push(`turned ${o.rotate}° clockwise`)
  if (o.flipH) parts.push('flipped left–right')
  if (o.flipV) parts.push('flipped top–bottom')
  return parts.join(' · ')
}

/** What to send: only the parts that are set, so an untouched picture adds nothing to the request. */
export function orientationRequest(o: Orientation): { rotate?: Exclude<Rotation, 0>; flipH?: boolean; flipV?: boolean } {
  return { ...(o.rotate ? { rotate: o.rotate as Exclude<Rotation, 0> } : {}), ...(o.flipH ? { flipH: true } : {}), ...(o.flipV ? { flipV: true } : {}) }
}

/** How much of each edge the apps that show vertical video draw their own buttons and captions over (about, as fractions of the picture). */
export interface SafeInsets {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * Where to keep text and faces: for tall pictures (Shorts, Reels, TikTok) clear of the title, buttons and caption area those apps
 * overlay; for anything else, the usual 5 % title-safe margin. A guide, not a rule — the apps differ and change.
 */
export function safeInsets(aspect: number): SafeInsets {
  if (aspect > 0 && aspect < 0.7) return { top: 0.12, right: 0.14, bottom: 0.22, left: 0.05 }
  return { top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 }
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
