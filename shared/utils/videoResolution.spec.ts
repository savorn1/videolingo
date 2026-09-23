import { describe, expect, it } from 'vitest'
import { describeResolution } from './videoResolution'

describe('describeResolution', () => {
  it('describes a standard landscape video', () => {
    expect(describeResolution(1920, 1080)).toEqual({ size: '1920×1080', aspect: '16:9', quality: '1080p' })
  })

  it('uses the short side for quality, so portrait videos are labelled correctly', () => {
    expect(describeResolution(1080, 1920)).toEqual({ size: '1080×1920', aspect: '9:16', quality: '1080p' })
  })

  it('labels 4K and small sizes', () => {
    expect(describeResolution(3840, 2160)?.quality).toBe('4K')
    expect(describeResolution(426, 240)?.quality).toBe('240p')
  })

  it('omits a ratio that is not a recognisable one', () => {
    expect(describeResolution(1366, 768)?.aspect).toBeNull()
  })

  it('returns null when either dimension is missing', () => {
    expect(describeResolution(null, 1080)).toBeNull()
    expect(describeResolution(1920, 0)).toBeNull()
  })
})
