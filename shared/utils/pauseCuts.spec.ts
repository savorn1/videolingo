import { describe, expect, it } from 'vitest'
import { pausesToCuts } from './pauseCuts'

const o = { minPauseMs: 1000, keepMs: 200, durationMs: 30_000 }

describe('pausesToCuts', () => {
  it('cuts long pauses, keeping a little quiet next to the speech', () => {
    const r = pausesToCuts(
      [
        { startMs: 5000, endMs: 7000 },
        { startMs: 10_000, endMs: 10_600 }
      ],
      [],
      o
    )
    expect(r.cuts).toEqual([{ startMs: 5200, endMs: 6800 }])
    expect(r.savedMs).toBe(1600)
    expect(r.skipped).toBe(0)
  })
  it('cuts silence at the very start and end whole', () => {
    const r = pausesToCuts(
      [
        { startMs: 0, endMs: 1500 },
        { startMs: 28_000, endMs: 30_000 }
      ],
      [],
      o
    )
    expect(r.cuts).toEqual([
      { startMs: 0, endMs: 1300 },
      { startMs: 28_200, endMs: 30_000 }
    ])
  })
  it('never leaves a sliver of speech shorter than half a second between cuts, keeping the longer pause', () => {
    const r = pausesToCuts(
      [
        { startMs: 5000, endMs: 8000 },
        { startMs: 8300, endMs: 9500 }
      ],
      [],
      { ...o, keepMs: 0 }
    )
    expect(r.cuts).toEqual([{ startMs: 5000, endMs: 8000 }])
    expect(r.skipped).toBe(1)
  })
  it('fits within the cut limit with the cuts already made, longest first', () => {
    const existing = Array.from({ length: 19 }, (_, i) => ({ startMs: i * 1000 + 1000, endMs: i * 1000 + 1100 }))
    const r = pausesToCuts(
      [
        { startMs: 21_000, endMs: 23_000 },
        { startMs: 25_000, endMs: 28_000 }
      ],
      existing,
      o
    )
    expect(r.cuts).toEqual([{ startMs: 25_200, endMs: 27_800 }])
    expect(r.skipped).toBe(1)
  })
})
