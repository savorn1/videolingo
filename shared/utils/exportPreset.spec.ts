import { describe, expect, it } from 'vitest'
import { isPresetData, presetFromSettings, ratioLabel, sanitizePresets } from './exportPreset'

describe('isPresetData', () => {
  it('accepts a shape with a whole-pixel size', () => {
    expect(isPresetData({ aspect: 16 / 9, w: 1920, h: 1080 })).toBe(true)
  })
  it('rejects a missing or bad shape or size', () => {
    for (const bad of [null, 'x', {}, { aspect: 0, w: 10, h: 10 }, { aspect: -1, w: 10, h: 10 }, { aspect: Number.NaN, w: 10, h: 10 }]) {
      expect(isPresetData(bad)).toBe(false)
    }
    for (const size of [{ w: 0, h: 10 }, { w: 10.5, h: 10 }, { w: 10, h: -2 }, { w: '10', h: 10 }, { w: 99_999, h: 10 }, { w: 10 }]) {
      expect(isPresetData({ aspect: 1, ...size })).toBe(false)
    }
  })
})

describe('presetFromSettings', () => {
  it('needs crop and resize both on, with a fixed shape', () => {
    expect(presetFromSettings(true, 1, true, { w: 1080, h: 1080 })).toEqual({ aspect: 1, w: 1080, h: 1080 })
    expect(presetFromSettings(false, 1, true, { w: 1080, h: 1080 })).toBeNull()
    expect(presetFromSettings(true, 1, false, { w: 1080, h: 1080 })).toBeNull()
    expect(presetFromSettings(true, null, true, { w: 1080, h: 1080 })).toBeNull()
  })
  it('refuses an empty or oversized output', () => {
    expect(presetFromSettings(true, 1, true, { w: 0, h: 0 })).toBeNull()
    expect(presetFromSettings(true, 1, true, { w: 50_000, h: 100 })).toBeNull()
  })
  it('rounds the size to whole pixels', () => {
    expect(presetFromSettings(true, 1, true, { w: 1080.4, h: 1079.6 })).toEqual({ aspect: 1, w: 1080, h: 1080 })
  })
})

describe('ratioLabel', () => {
  it('names the common shapes', () => {
    expect(ratioLabel(16 / 9)).toBe('16:9')
    expect(ratioLabel(9 / 16)).toBe('9:16')
    expect(ratioLabel(1)).toBe('1:1')
    expect(ratioLabel(4 / 3)).toBe('4:3')
    expect(ratioLabel(21 / 9)).toBe('7:3')
  })
  it('falls back to a decimal when no small ratio fits', () => {
    expect(ratioLabel(1.3712)).toBe('1.37:1')
  })
})

describe('sanitizePresets', () => {
  const good = { id: 'a', name: 'Reels', savedAt: 1, data: { aspect: 9 / 16, w: 1080, h: 1920 } }
  it('keeps well-formed entries', () => {
    expect(sanitizePresets([good])).toEqual([good])
  })
  it('drops anything else, and non-lists', () => {
    expect(sanitizePresets([good, null, { ...good, id: 5 }, { ...good, data: { aspect: 0, w: 1, h: 1 } }, 'x'])).toEqual([good])
    expect(sanitizePresets({})).toEqual([])
    expect(sanitizePresets(null)).toEqual([])
  })
})
