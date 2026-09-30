import { describe, expect, it } from 'vitest'
import { MAX_SLIDES, nextSlideStart, slideIndexAt, slideProblem, slidesBeyond, spreadEvenly, swapContents } from './slides'

describe('slideProblem', () => {
  it('accepts no pictures, one, or ascending starts a second or more apart', () => {
    expect(slideProblem([])).toBeNull()
    expect(slideProblem([0])).toBeNull()
    expect(slideProblem([0, 1000, 60_000])).toBeNull()
  })
  it('needs the first to start at zero', () => {
    expect(slideProblem([500, 5000])).toMatch(/0:00/)
  })
  it('names the picture that starts too soon', () => {
    expect(slideProblem([0, 5000, 5500])).toMatch(/Picture 3.*after picture 2/)
    expect(slideProblem([0, 5000, 4000])).toMatch(/Picture 3/)
    expect(slideProblem([0, 5000, 5000])).toMatch(/Picture 3/)
  })
  it('has a limit', () => {
    expect(slideProblem(Array.from({ length: MAX_SLIDES + 1 }, (_, i) => i * 2000))).toMatch(String(MAX_SLIDES))
    expect(slideProblem(Array.from({ length: MAX_SLIDES }, (_, i) => i * 2000))).toBeNull()
  })
})

describe('slidesBeyond', () => {
  it('counts pictures that start after the sound ends, or in its last half second', () => {
    expect(slidesBeyond([0, 5000, 9400, 9600, 12_000], 10)).toBe(2)
  })
  it('never counts the first picture, and knows nothing without a length', () => {
    expect(slidesBeyond([0], 0.4)).toBe(0)
    expect(slidesBeyond([0, 999_999], null)).toBe(0)
  })
})

describe('spreadEvenly', () => {
  it('splits the sound into equal parts on whole seconds', () => {
    expect(spreadEvenly(4, 100)).toEqual([0, 25_000, 50_000, 75_000])
    expect(spreadEvenly(1, 100)).toEqual([0])
    expect(spreadEvenly(3, 100)).toEqual([0, 33_000, 67_000])
  })
  it('gives nothing when the sound is too short for that many pictures', () => {
    expect(spreadEvenly(5, 4)).toBeNull()
    expect(spreadEvenly(0, 100)).toBeNull()
    expect(spreadEvenly(5, 5)).toEqual([0, 1000, 2000, 3000, 4000])
  })
  it('always satisfies the rule it exists to help with', () => {
    for (const [count, seconds] of [[7, 70], [3, 100], [10, 17], [30, 45]] as const) {
      const starts = spreadEvenly(count, seconds)!
      expect(slideProblem(starts)).toBeNull()
      expect(slidesBeyond(starts, seconds)).toBe(0)
    }
  })
})

describe('nextSlideStart', () => {
  it('starts the first at zero and later ones 30 s after the last', () => {
    expect(nextSlideStart([], 100)).toBe(0)
    expect(nextSlideStart([0], null)).toBe(30_000)
    expect(nextSlideStart([0, 30_000], 300)).toBe(60_000)
  })
  it('falls back to halfway through what is left when 30 s would run past the end', () => {
    expect(nextSlideStart([0], 20)).toBe(10_000)
    expect(nextSlideStart([0, 10_000], 12)).toBe(11_000)
  })
})

describe('slideIndexAt', () => {
  it('finds the last picture that has started', () => {
    expect(slideIndexAt([0, 5000, 9000], 0)).toBe(0)
    expect(slideIndexAt([0, 5000, 9000], 4999)).toBe(0)
    expect(slideIndexAt([0, 5000, 9000], 5000)).toBe(1)
    expect(slideIndexAt([0, 5000, 9000], 99_000)).toBe(2)
    expect(slideIndexAt([], 100)).toBe(0)
  })
})

describe('swapContents', () => {
  const rows = [
    { name: 'a', startMs: 0 },
    { name: 'b', startMs: 5000 },
    { name: 'c', startMs: 9000 }
  ]
  it('swaps the pictures and keeps the times where they are', () => {
    expect(swapContents(rows, 0, 1)).toEqual([
      { name: 'b', startMs: 0 },
      { name: 'a', startMs: 5000 },
      { name: 'c', startMs: 9000 }
    ])
  })
  it('does not change its input', () => {
    swapContents(rows, 1, 2)
    expect(rows.map((r) => r.name)).toEqual(['a', 'b', 'c'])
  })
  it('does nothing for a move off either end', () => {
    expect(swapContents(rows, 0, -1)).toBe(rows)
    expect(swapContents(rows, 2, 3)).toBe(rows)
    expect(swapContents(rows, 1, 1)).toBe(rows)
  })
})
