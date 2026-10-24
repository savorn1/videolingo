import { describe, expect, it } from 'vitest'
import { filmstripTimes, peakColumns, thumbnailFontPx, thumbnailLines } from './filmstrip'

describe('filmstripTimes', () => {
  it('takes the middle of each slice', () => {
    expect(filmstripTimes(10_000, 4)).toEqual([1250, 3750, 6250, 8750])
    expect(filmstripTimes(0, 4)).toEqual([])
  })
})

describe('thumbnailLines', () => {
  it('wraps words and cuts after the last line', () => {
    expect(thumbnailLines('How to say hello in Spanish', 12)).toEqual(['How to say', 'hello in', 'Spanish'])
    expect(thumbnailLines('one two three four five six seven', 9, 2)).toEqual(['one two', 'three…'])
  })
  it('makes fewer lines bigger', () => {
    expect(thumbnailFontPx(720, 1)).toBeGreaterThan(thumbnailFontPx(720, 3))
  })
})

describe('peakColumns', () => {
  it('keeps the loudest of each slice', () => {
    expect(peakColumns([0.1, 0.9, 0.2, 0.3, 0.5, 0.4], 3)).toEqual([0.9, 0.3, 0.5])
    expect(peakColumns([0.5], 3)).toEqual([0.5, 0.5, 0.5])
    expect(peakColumns([], 3)).toEqual([])
  })
})
