import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from './audioVideo'
import { describeSeriesLook, sanitizeSeriesLook, sanitizeSeriesLooks, type SeriesLook } from './seriesLook'

const look: SeriesLook = { ...DEFAULT_LOOK, stripText: 'Episode 4', titleCard: false, spreadPerRecording: true }

describe('sanitizeSeriesLook', () => {
  it('keeps a valid look as it is', () => {
    expect(sanitizeSeriesLook(look)).toEqual(look)
  })
  it('falls back to the defaults for anything missing or wrong', () => {
    expect(sanitizeSeriesLook({ waveform: 'ZIGZAG', stripText: 5, titleCard: 'yes' })).toEqual({
      ...DEFAULT_LOOK,
      stripText: '',
      titleCard: false,
      spreadPerRecording: false
    })
    expect(sanitizeSeriesLook(null)).toEqual({ ...DEFAULT_LOOK, stripText: '', titleCard: false, spreadPerRecording: false })
  })
  it('cuts the strip to its limit', () => {
    expect(sanitizeSeriesLook({ stripText: 'x'.repeat(500) }).stripText).toHaveLength(120)
  })
})

describe('sanitizeSeriesLooks', () => {
  it('drops what is not an entry and cleans each look', () => {
    const list = sanitizeSeriesLooks([{ id: 'a', name: 'Podcast', savedAt: 1, data: { ...look, resolution: '8k' } }, { id: 2 }, 'x', null])
    expect(list).toHaveLength(1)
    expect(list[0]!.data.resolution).toBe('720p')
  })
  it('is empty for anything but a list', () => {
    expect(sanitizeSeriesLooks({})).toEqual([])
  })
})

describe('describeSeriesLook', () => {
  it('says what the look sets', () => {
    expect(describeSeriesLook(look, (s) => s)).toBe('720p · no waveform · strip')
    expect(describeSeriesLook({ ...look, shape: 'TALL', waveform: 'PULSE', stripText: '', denoise: true }, (s) => s.toLowerCase())).toBe(
      '720p · Tall · pulse · sound clean-up'
    )
  })
})
