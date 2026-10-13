import { describe, expect, it } from 'vitest'
import { currentChapterIndex, nextChapterStart, previousChapterStart } from './chapters'

const C = [
  { atMs: 0, label: 'Greetings' },
  { atMs: 60_000, label: 'Numbers' },
  { atMs: 120_000, label: 'Practice' }
]

describe('chapters', () => {
  it('knows the chapter playing', () => {
    expect(currentChapterIndex(C, 0)).toBe(0)
    expect(currentChapterIndex(C, 75_000)).toBe(1)
    expect(currentChapterIndex(C, 500_000)).toBe(2)
    expect(currentChapterIndex([{ atMs: 5000, label: 'x' }], 1000)).toBe(-1)
  })
  it('goes to the next chapter, and to the start of this one or the one before', () => {
    expect(nextChapterStart(C, 30_000)).toBe(60_000)
    expect(nextChapterStart(C, 130_000)).toBeNull()
    expect(previousChapterStart(C, 75_000)).toBe(60_000)
    expect(previousChapterStart(C, 61_000)).toBe(0)
    expect(previousChapterStart(C, 500)).toBe(0)
  })
})
