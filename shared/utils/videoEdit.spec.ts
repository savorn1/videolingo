import { describe, expect, it } from 'vitest'
import { findSplitTarget, MAX_VIDEO_TITLE, replacesOriginal, suggestedNewTitle, MAX_SEGMENTS, MIN_TRIM_MS, splitRowAt, uncoveredMs, validateCrop, validateScale, validateSegments, validateTrim, withTrimEdge } from './videoEdit'

describe('validateTrim', () => {
  it('accepts a valid range', () => {
    expect(validateTrim(1000, 5000, 10000)).toBeNull()
    expect(validateTrim(1000, null, 10000)).toBeNull()
    expect(validateTrim(0, 100, null)).toBeNull()
  })
  it('rejects out-of-bounds or backwards ranges', () => {
    expect(validateTrim(-1, 100, null)).not.toBeNull()
    expect(validateTrim(500, 500, null)).not.toBeNull()
    expect(validateTrim(500, 400, null)).not.toBeNull()
    expect(validateTrim(10000, 12000, 10000)).not.toBeNull()
    expect(validateTrim(1000, 20000, 10000)).not.toBeNull()
  })
})

describe('validateCrop', () => {
  it('accepts a crop that fits inside the video', () => {
    expect(validateCrop(0, 0, 640, 480, 1280, 720)).toBeNull()
    expect(validateCrop(0, 0, 640, 480, null, null)).toBeNull()
  })
  it('rejects a crop outside the video or with non-positive size', () => {
    expect(validateCrop(0, 0, 0, 480, 1280, 720)).not.toBeNull()
    expect(validateCrop(-1, 0, 640, 480, 1280, 720)).not.toBeNull()
    expect(validateCrop(1000, 0, 640, 480, 1280, 720)).not.toBeNull()
    expect(validateCrop(0, 500, 640, 480, 1280, 720)).not.toBeNull()
  })
})

describe('validateScale', () => {
  it('requires a positive width and height', () => {
    expect(validateScale(640, 480)).toBeNull()
    expect(validateScale(0, 480)).not.toBeNull()
    expect(validateScale(640, -1)).not.toBeNull()
  })
})

describe('validateSegments', () => {
  it('needs at least one segment and at most the cap', () => {
    expect(validateSegments([], null)).not.toBeNull()
    expect(validateSegments([{ startMs: 0, endMs: 1000 }], 10000)).toBeNull()
    expect(
      validateSegments(
        Array.from({ length: MAX_SEGMENTS + 1 }, () => ({ startMs: 0, endMs: 100 })),
        null
      )
    ).not.toBeNull()
  })
  it('validates each range individually, naming which one failed', () => {
    const error = validateSegments(
      [
        { startMs: 0, endMs: 1000 },
        { startMs: 900, endMs: 500 }
      ],
      null
    )
    expect(error).toContain('Segment 2')
  })
})

describe('withTrimEdge', () => {
  it('moves the start and the end', () => {
    expect(withTrimEdge([0, 10_000], 'start', 2_000, 10_000)).toEqual([2_000, 10_000])
    expect(withTrimEdge([0, 10_000], 'end', 8_000, 10_000)).toEqual([0, 8_000])
  })
  it('keeps the edges inside the video', () => {
    expect(withTrimEdge([1_000, 10_000], 'start', -500, 10_000)).toEqual([0, 10_000])
    expect(withTrimEdge([0, 5_000], 'end', 99_000, 10_000)).toEqual([0, 10_000])
  })
  it('never leaves less than the minimum between the handles', () => {
    expect(withTrimEdge([0, 5_000], 'start', 9_000, 10_000)).toEqual([5_000 - MIN_TRIM_MS, 5_000])
    expect(withTrimEdge([4_000, 10_000], 'end', 1_000, 10_000)).toEqual([4_000, 4_000 + MIN_TRIM_MS])
  })
  it('rounds to whole milliseconds', () => {
    expect(withTrimEdge([0, 10_000], 'start', 1_234.6, 10_000)).toEqual([1_235, 10_000])
  })
  it('still works before the duration is known', () => {
    expect(withTrimEdge([0, 0], 'end', 5_000, 0)).toEqual([0, MIN_TRIM_MS])
  })
})

describe('findSplitTarget', () => {
  const rows = [
    { startMsSeconds: 0, endMsSeconds: 10 },
    { startMsSeconds: 10, endMsSeconds: null }
  ]
  it('finds the row the playhead is inside', () => {
    expect(findSplitTarget(rows, 4, 30)).toBe(0)
    expect(findSplitTarget(rows, 20, 30)).toBe(1)
  })
  it('treats an open end as the end of the video', () => {
    expect(findSplitTarget(rows, 29.95, 30)).toBeNull()
    expect(findSplitTarget(rows, 29.5, 30)).toBe(1)
  })
  it('refuses a cut too close to an edge', () => {
    expect(findSplitTarget(rows, 0.05, 30)).toBeNull()
    expect(findSplitTarget(rows, 10, 30)).toBeNull()
    expect(findSplitTarget(rows, 9.95, 30)).toBeNull()
  })
  it('finds nothing in a gap', () => {
    expect(findSplitTarget([{ startMsSeconds: 0, endMsSeconds: 5 }, { startMsSeconds: 20, endMsSeconds: null }], 10, 30)).toBeNull()
  })
})

describe('splitRowAt', () => {
  it('cuts one row into two that meet at the cut', () => {
    const rows = [{ startMsSeconds: 0, endMsSeconds: null }]
    expect(splitRowAt(rows, 0, 12.3456)).toEqual([
      { startMsSeconds: 0, endMsSeconds: 12.35 },
      { startMsSeconds: 12.35, endMsSeconds: null }
    ])
  })
  it('keeps the rows around it in place and does not change the input', () => {
    const rows = [
      { startMsSeconds: 0, endMsSeconds: 5 },
      { startMsSeconds: 5, endMsSeconds: 15 },
      { startMsSeconds: 15, endMsSeconds: null }
    ]
    const out = splitRowAt(rows, 1, 10)
    expect(out).toHaveLength(4)
    expect(out.map((r) => r.startMsSeconds)).toEqual([0, 5, 10, 15])
    expect(out[1]!.endMsSeconds).toBe(10)
    expect(rows).toHaveLength(3)
  })
  it('returns the list unchanged for a row that is not there', () => {
    const rows = [{ startMsSeconds: 0, endMsSeconds: null }]
    expect(splitRowAt(rows, 3, 5)).toBe(rows)
  })
})

describe('uncoveredMs', () => {
  it('is zero when the rows cover the whole video', () => {
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: null }], 30_000)).toBe(0)
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: 10 }, { startMsSeconds: 10, endMsSeconds: null }], 30_000)).toBe(0)
  })
  it('counts a gap between rows and a start that is not at zero', () => {
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: 10 }, { startMsSeconds: 15, endMsSeconds: null }], 30_000)).toBe(5_000)
    expect(uncoveredMs([{ startMsSeconds: 4, endMsSeconds: null }], 30_000)).toBe(4_000)
  })
  it('counts an overlap once', () => {
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: 20 }, { startMsSeconds: 10, endMsSeconds: 25 }], 30_000)).toBe(5_000)
  })
  it('ignores rows that run backwards or past the end', () => {
    expect(uncoveredMs([{ startMsSeconds: 20, endMsSeconds: 5 }], 30_000)).toBe(30_000)
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: 99 }], 30_000)).toBe(0)
  })
  it('is zero while the duration is unknown', () => {
    expect(uncoveredMs([{ startMsSeconds: 0, endMsSeconds: 5 }], 0)).toBe(0)
  })
})

describe('replacesOriginal', () => {
  it('is true for the edits that swap the video file itself', () => {
    expect(replacesOriginal('TRIM')).toBe(true)
    expect(replacesOriginal('AUDIO')).toBe(true)
    expect(replacesOriginal('OVERLAY')).toBe(true)
  })
  it('is false for split segments and extracted audio', () => {
    expect(replacesOriginal('SPLIT')).toBe(false)
    expect(replacesOriginal('EXTRACT')).toBe(false)
  })
})

describe('suggestedNewTitle', () => {
  it('says what was done to the original', () => {
    expect(suggestedNewTitle('Lesson', 'TRIM')).toBe('Lesson (trimmed)')
    expect(suggestedNewTitle('Lesson', 'AUDIO')).toBe('Lesson (edited audio)')
    expect(suggestedNewTitle('Lesson', 'OVERLAY')).toBe('Lesson (with text & overlays)')
    expect(suggestedNewTitle('Lesson', 'SPLIT', 2)).toBe('Lesson — Part 3')
    expect(suggestedNewTitle('Lesson', 'SPLIT')).toBe('Lesson — Part 1')
  })
  it('copes with a missing title', () => {
    expect(suggestedNewTitle(null, 'TRIM')).toBe('Video (trimmed)')
    expect(suggestedNewTitle('  ', 'TRIM')).toBe('Video (trimmed)')
  })
  it('shortens the original, not the suffix, to stay within the limit', () => {
    const title = suggestedNewTitle('x'.repeat(300), 'TRIM')
    expect(title).toHaveLength(MAX_VIDEO_TITLE)
    expect(title.endsWith('… (trimmed)')).toBe(true)
  })
})
