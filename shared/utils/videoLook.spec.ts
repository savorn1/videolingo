import { describe, expect, it } from 'vitest'
import { LOOK_PRESETS, MAX_LOOK_BLUR, PLAIN_LOOK, cssFilter, describeVideoLook, isPlainLook, lookRequest, matchingPreset, validateLook } from './videoLook'

describe('isPlainLook / lookRequest', () => {
  it('treats null and the default as plain', () => {
    expect(isPlainLook(null)).toBe(true)
    expect(isPlainLook(PLAIN_LOOK)).toBe(true)
    expect(isPlainLook({ ...PLAIN_LOOK, vignette: true })).toBe(false)
  })
  it('sends nothing for a plain look, and a copy otherwise', () => {
    expect(lookRequest(PLAIN_LOOK)).toBeNull()
    const look = { ...PLAIN_LOOK, blur: 2 }
    expect(lookRequest(look)).toEqual(look)
    expect(lookRequest(look)).not.toBe(look)
  })
})

describe('presets', () => {
  it('all validate, none is plain, and each matches itself', () => {
    for (const p of LOOK_PRESETS) {
      expect(validateLook(p.look)).toBeNull()
      expect(isPlainLook(p.look)).toBe(false)
      expect(matchingPreset(p.look)).toBe(p)
    }
  })
  it('stops matching once a slider moves', () => {
    expect(matchingPreset({ ...LOOK_PRESETS[0]!.look, blur: 1 })).toBeNull()
    expect(matchingPreset(PLAIN_LOOK)).toBeNull()
  })
})

describe('validateLook', () => {
  it('accepts the edges and rejects outside them', () => {
    expect(validateLook(null)).toBeNull()
    expect(validateLook({ ...PLAIN_LOOK, brightness: -1, contrast: 2, saturation: 3, blur: MAX_LOOK_BLUR })).toBeNull()
    expect(validateLook({ ...PLAIN_LOOK, brightness: 1.1 })).toMatch(/Brightness/)
    expect(validateLook({ ...PLAIN_LOOK, contrast: 2.5 })).toMatch(/Contrast/)
    expect(validateLook({ ...PLAIN_LOOK, saturation: -1 })).toMatch(/Colour/)
    expect(validateLook({ ...PLAIN_LOOK, blur: MAX_LOOK_BLUR + 1 })).toMatch(/Blur/)
    expect(validateLook({ ...PLAIN_LOOK, brightness: NaN })).toMatch(/Brightness/)
  })
})

describe('cssFilter', () => {
  it('is empty for a plain look', () => {
    expect(cssFilter(null)).toBe('')
    expect(cssFilter(PLAIN_LOOK)).toBe('')
  })
  it('builds the filter in order', () => {
    expect(cssFilter({ ...PLAIN_LOOK, brightness: 0.2, contrast: 1.5, saturation: 2, blur: 4 })).toBe('brightness(1.2) contrast(1.5) saturate(2) blur(2px)')
  })
  it('black and white wins over colour and tint', () => {
    expect(cssFilter({ ...PLAIN_LOOK, grayscale: true, sepia: true, saturation: 2 })).toBe('grayscale(1)')
    expect(cssFilter({ ...PLAIN_LOOK, sepia: true })).toBe('sepia(1)')
  })
  it('ignores the vignette, which CSS cannot show', () => {
    expect(cssFilter({ ...PLAIN_LOOK, vignette: true })).toBe('')
  })
})

describe('describeVideoLook', () => {
  it('names a preset, or lists the changes', () => {
    expect(describeVideoLook(PLAIN_LOOK)).toBeNull()
    expect(describeVideoLook(LOOK_PRESETS[3]!.look)).toBe('Black & white look')
    expect(describeVideoLook({ ...PLAIN_LOOK, brightness: -0.3, blur: 3, vignette: true })).toBe('darker, blurred, vignette')
  })
})
