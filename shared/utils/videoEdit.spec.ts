import { describe, expect, it } from 'vitest'
import { MAX_SEGMENTS, validateCrop, validateScale, validateSegments, validateTrim } from './videoEdit'

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
