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
