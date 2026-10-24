import { describe, expect, it } from 'vitest'
import { chapterTitleSpans, currentChapterIndex, nextChapterStart, previousChapterStart } from './chapters'

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

describe('chapter titles on the picture', () => {
  it('shows each chapter title from its start, cut short by the next one and the end; chapter markers only when there are any', () => {
    const markers = [
      { atMs: 8000, label: 'Numbers', chapter: true },
      { atMs: 0, label: ' Welcome ', chapter: true },
      { atMs: 2500, label: 'Note to self', chapter: false },
      { atMs: 9800, label: 'Too short', chapter: true },
      { atMs: 3000, label: ' ', chapter: true }
    ]
    expect(chapterTitleSpans(markers, 10_000)).toEqual([
      { startMs: 0, endMs: 4000, text: 'Welcome' },
      { startMs: 8000, endMs: 9800, text: 'Numbers' }
    ])
    expect(chapterTitleSpans([{ atMs: 1000, label: 'Any', chapter: false }], 10_000, 2000)).toEqual([{ startMs: 1000, endMs: 3000, text: 'Any' }])
  })
})
