import { describe, expect, it } from 'vitest'
import {
  MAX_EXTEND_MS,
  extensionMs,
  trimLimitMs,
  findSplitTarget,
  MAX_VIDEO_TITLE,
  replacesOriginal,
  suggestedNewTitle,
  MAX_SEGMENTS,
  MIN_TRIM_MS,
  boundaryAfter,
  centeredCrop,
  describeOrientation,
  hasOrientation,
  NO_ORIENTATION,
  orientationRequest,
  orientedSize,
  turned,
  safeInsets,
  maxEvenParts,
  moveBoundary,
  splitEveryRows,
  splitEvenlyRows,
  splitRowAt,
  uncoveredMs,
  validateCrop,
  validateScale,
  validateSegments,
  validateTrim,
  withTrimEdge
} from './videoEdit'

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
    expect(
      findSplitTarget(
        [
          { startMsSeconds: 0, endMsSeconds: 5 },
          { startMsSeconds: 20, endMsSeconds: null }
        ],
        10,
        30
      )
    ).toBeNull()
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
    expect(
      uncoveredMs(
        [
          { startMsSeconds: 0, endMsSeconds: 10 },
          { startMsSeconds: 10, endMsSeconds: null }
        ],
        30_000
      )
    ).toBe(0)
  })
  it('counts a gap between rows and a start that is not at zero', () => {
    expect(
      uncoveredMs(
        [
          { startMsSeconds: 0, endMsSeconds: 10 },
          { startMsSeconds: 15, endMsSeconds: null }
        ],
        30_000
      )
    ).toBe(5_000)
    expect(uncoveredMs([{ startMsSeconds: 4, endMsSeconds: null }], 30_000)).toBe(4_000)
  })
  it('counts an overlap once', () => {
    expect(
      uncoveredMs(
        [
          { startMsSeconds: 0, endMsSeconds: 20 },
          { startMsSeconds: 10, endMsSeconds: 25 }
        ],
        30_000
      )
    ).toBe(5_000)
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

describe('maxEvenParts', () => {
  it('is 0 for an unknown duration', () => {
    expect(maxEvenParts(0)).toBe(0)
  })
  it('keeps every part at least MIN_TRIM_MS long', () => {
    expect(maxEvenParts(5 * MIN_TRIM_MS)).toBe(5)
    expect(maxEvenParts(MIN_TRIM_MS / 2)).toBe(1)
  })
  it('is capped at MAX_SEGMENTS', () => {
    expect(maxEvenParts(10 * 60 * 1000)).toBe(MAX_SEGMENTS)
  })
})

describe('splitEvenlyRows', () => {
  it('cuts into equal rows, the last running to the end', () => {
    expect(splitEvenlyRows(10000, 4)).toEqual([
      { startMsSeconds: 0, endMsSeconds: 2.5 },
      { startMsSeconds: 2.5, endMsSeconds: 5 },
      { startMsSeconds: 5, endMsSeconds: 7.5 },
      { startMsSeconds: 7.5, endMsSeconds: null }
    ])
  })
  it('leaves no gaps between rows', () => {
    const rows = splitEvenlyRows(100000, 7)
    rows.slice(1).forEach((r, i) => expect(r.startMsSeconds).toBe(rows[i]!.endMsSeconds))
  })
  it('returns nothing for impossible counts', () => {
    expect(splitEvenlyRows(10000, 0)).toEqual([])
    expect(splitEvenlyRows(10000, 2.5)).toEqual([])
    expect(splitEvenlyRows(1000, 5)).toEqual([])
    expect(splitEvenlyRows(10 * 60 * 1000, MAX_SEGMENTS + 1)).toEqual([])
    expect(splitEvenlyRows(0, 2)).toEqual([])
  })
})

describe('splitEveryRows', () => {
  it('cuts every N seconds, the last row taking the rest', () => {
    expect(splitEveryRows(25000, 10)).toEqual([
      { startMsSeconds: 0, endMsSeconds: 10 },
      { startMsSeconds: 10, endMsSeconds: 20 },
      { startMsSeconds: 20, endMsSeconds: null }
    ])
  })
  it('folds a too-short remainder into the last row', () => {
    expect(splitEveryRows(20200, 10)).toHaveLength(2)
  })
  it('returns nothing when it cannot work', () => {
    expect(splitEveryRows(10000, 0)).toEqual([])
    expect(splitEveryRows(10000, 10)).toEqual([])
    expect(splitEveryRows(10000, 0.1)).toEqual([])
    expect(splitEveryRows(10 * 60 * 1000, 1)).toEqual([])
  })
})

describe('moveBoundary', () => {
  const rows = [
    { startMsSeconds: 0, endMsSeconds: 5 },
    { startMsSeconds: 5, endMsSeconds: null }
  ]
  it('finds touching boundaries only', () => {
    expect(boundaryAfter(rows, 0)).toBe(5)
    expect(boundaryAfter(rows, 1)).toBeNull()
    expect(
      boundaryAfter(
        [
          { startMsSeconds: 0, endMsSeconds: 4 },
          { startMsSeconds: 5, endMsSeconds: null }
        ],
        0
      )
    ).toBeNull()
  })
  it('moves both sides together', () => {
    const out = moveBoundary(rows, 0, 7.123, 10000)
    expect(out[0]!.endMsSeconds).toBe(7.12)
    expect(out[1]!.startMsSeconds).toBe(7.12)
  })
  it('keeps each side at least MIN_TRIM_MS long', () => {
    expect(moveBoundary(rows, 0, -3, 10000)[0]!.endMsSeconds).toBe(MIN_TRIM_MS / 1000)
    expect(moveBoundary(rows, 0, 99, 10000)[1]!.startMsSeconds).toBe(10 - MIN_TRIM_MS / 1000)
  })
})

describe('centeredCrop', () => {
  it('fits the largest box of the shape, centred', () => {
    expect(centeredCrop(9 / 16, 1920, 1080)).toEqual({ x: 656, y: 0, w: 608, h: 1080 })
    expect(centeredCrop(1, 1920, 1080)).toEqual({ x: 420, y: 0, w: 1080, h: 1080 })
    expect(centeredCrop(16 / 9, 1080, 1080)).toEqual({ x: 0, y: 236, w: 1080, h: 608 })
  })
  it('can be centred elsewhere, kept inside the frame', () => {
    expect(centeredCrop(1, 1920, 1080, 0, 0)).toEqual({ x: 0, y: 0, w: 1080, h: 1080 })
  })
  it('is empty for an unknown frame or shape', () => {
    expect(centeredCrop(1, 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(centeredCrop(0, 100, 100)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('safeInsets', () => {
  it('keeps clear of the app buttons and captions on tall pictures', () => {
    const t = safeInsets(9 / 16)
    expect(t.bottom).toBeGreaterThan(t.top)
    expect(t.right).toBeGreaterThan(t.left)
  })
  it('is an even 5 % margin for wide and square pictures', () => {
    for (const a of [16 / 9, 1, 4 / 3]) expect(safeInsets(a)).toEqual({ top: 0.05, right: 0.05, bottom: 0.05, left: 0.05 })
  })
  it('falls back to the even margin for a nonsense shape', () => {
    expect(safeInsets(0).top).toBe(0.05)
    expect(safeInsets(NaN).top).toBe(0.05)
  })
})

describe('turning and flipping', () => {
  const none = NO_ORIENTATION
  it('knows when nothing is asked for', () => {
    expect(hasOrientation(none)).toBe(false)
    expect(hasOrientation({ ...none, flipV: true })).toBe(true)
    expect(hasOrientation({ ...none, rotate: 90 })).toBe(true)
  })
  it('turns in quarter steps, both ways, around 360', () => {
    expect(turned(none, 1).rotate).toBe(90)
    expect(turned(none, -1).rotate).toBe(270)
    expect(turned({ ...none, rotate: 270 }, 1).rotate).toBe(0)
    expect(turned({ ...none, rotate: 0 }, -1).rotate).toBe(270)
  })
  it('swaps width and height on a quarter turn only', () => {
    expect(orientedSize(1920, 1080, { ...none, rotate: 90 })).toEqual({ w: 1080, h: 1920 })
    expect(orientedSize(1920, 1080, { ...none, rotate: 270 })).toEqual({ w: 1080, h: 1920 })
    expect(orientedSize(1920, 1080, { ...none, rotate: 180 })).toEqual({ w: 1920, h: 1080 })
    expect(orientedSize(1920, 1080, { ...none, flipH: true })).toEqual({ w: 1920, h: 1080 })
  })
  it('describes it in words, matching the server', () => {
    expect(describeOrientation(none)).toBe('')
    expect(describeOrientation({ rotate: 90, flipH: true, flipV: false })).toBe('turned 90° clockwise · flipped left–right')
  })
  it('sends only what is set', () => {
    expect(orientationRequest(none)).toEqual({})
    expect(orientationRequest({ rotate: 180, flipH: false, flipV: true })).toEqual({ rotate: 180, flipV: true })
  })
})

describe('extending a trim past the video', () => {
  it('is refused unless asked for, and limited when it is', () => {
    expect(validateTrim(0, 70000, 60000)).toMatch(/past the end/)
    expect(validateTrim(0, 70000, 60000, true)).toBeNull()
    expect(validateTrim(0, 60000 + MAX_EXTEND_MS + 1, 60000, true)).toMatch(/at most/)
  })
  it('works out the limit and the extension', () => {
    expect(trimLimitMs(60000, false)).toBe(60000)
    expect(trimLimitMs(60000, true)).toBe(60000 + MAX_EXTEND_MS)
    expect(extensionMs(70000, 60000)).toBe(10000)
    expect(extensionMs(50000, 60000)).toBe(0)
    expect(extensionMs(null, 60000)).toBe(0)
  })
  it('lets the end edge move past the video up to the limit', () => {
    expect(withTrimEdge([0, 60000], 'end', 90000, trimLimitMs(60000, true))).toEqual([0, 90000])
    expect(withTrimEdge([0, 60000], 'end', 90000, 60000)).toEqual([0, 60000])
  })
})
