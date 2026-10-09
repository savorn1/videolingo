import { describe, expect, it } from 'vitest'
import { DEFAULT_DUB_MIX, DUB_MIX_PRESETS, isDubMixPreset, sanitizeDubMix } from './dubMix'

describe('sanitizeDubMix', () => {
  it('keeps a good mix, rounded to 5 % steps and clamped', () => {
    expect(sanitizeDubMix({ voice: 0.8, original: 0.23 })).toEqual({ voice: 0.8, original: 0.25 })
    expect(sanitizeDubMix({ voice: 3, original: -1 })).toEqual({ voice: 1, original: 0 })
  })
  it('falls back to the voice-over alone for anything unreadable', () => {
    expect(sanitizeDubMix(null)).toEqual(DEFAULT_DUB_MIX)
    expect(sanitizeDubMix('loud')).toEqual(DEFAULT_DUB_MIX)
    expect(sanitizeDubMix({ voice: 'x', original: NaN })).toEqual(DEFAULT_DUB_MIX)
  })
})

describe('isDubMixPreset', () => {
  it('matches a preset exactly', () => {
    expect(isDubMixPreset(DEFAULT_DUB_MIX, DUB_MIX_PRESETS[0]!.mix)).toBe(true)
    expect(isDubMixPreset({ voice: 1, original: 0.25 }, DUB_MIX_PRESETS[1]!.mix)).toBe(false)
  })
})
