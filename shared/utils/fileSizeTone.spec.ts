import { describe, expect, it } from 'vitest'
import { fileSizeClass, fileSizeTone, LARGE_FILE_BYTES, MEDIUM_FILE_BYTES } from './fileSizeTone'

describe('fileSizeClass', () => {
  it('sorts sizes into small, medium and large at the thresholds', () => {
    expect(fileSizeClass(1024)).toBe('small')
    expect(fileSizeClass(MEDIUM_FILE_BYTES - 1)).toBe('small')
    expect(fileSizeClass(MEDIUM_FILE_BYTES)).toBe('medium')
    expect(fileSizeClass(LARGE_FILE_BYTES - 1)).toBe('medium')
    expect(fileSizeClass(LARGE_FILE_BYTES)).toBe('large')
  })
  it('treats a missing or nonsense size as unknown', () => {
    for (const bad of [null, undefined, NaN, -5, Infinity]) expect(fileSizeClass(bad as number)).toBe('unknown')
  })
})

describe('fileSizeTone', () => {
  it('gives each class its own colour', () => {
    const tones = [0, MEDIUM_FILE_BYTES, LARGE_FILE_BYTES, null].map((b) => fileSizeTone(b))
    expect(new Set(tones).size).toBe(4)
  })
})
