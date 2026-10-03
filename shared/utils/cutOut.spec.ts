import { describe, expect, it } from 'vitest'
import { MAX_CUTS, MIN_CUT_MS, moveCutEdge, cutBetween, snapCut, cutSkipTarget, keptAfterCuts, lengthAfterCuts, mergeCutRanges, validateCutOut } from './cutOut'

const r = (startMs: number, endMs: number) => ({ startMs, endMs })

describe('mergeCutRanges', () => {
  it('sorts and joins overlapping or touching ranges, leaving the input alone', () => {
    const input = [r(40000, 45000), r(20000, 30000), r(28000, 32000), r(45000, 46000)]
    expect(mergeCutRanges(input)).toEqual([r(20000, 32000), r(40000, 46000)])
    expect(input[0]).toEqual(r(40000, 45000))
  })
})

describe('keptAfterCuts / lengthAfterCuts', () => {
  it('lists what stays', () => {
    expect(keptAfterCuts([r(20000, 30000)], 60000)).toEqual([r(0, 20000), r(30000, 60000)])
    expect(keptAfterCuts([r(0, 10000)], 60000)).toEqual([r(10000, 60000)])
    expect(keptAfterCuts([r(0, 60000)], 60000)).toEqual([])
  })
  it('adds up the length', () => {
    expect(lengthAfterCuts([r(20000, 30000), r(40000, 45000)], 60000)).toBe(45000)
  })
})

describe('validateCutOut', () => {
  it('accepts a middle cut, and cuts at either end', () => {
    expect(validateCutOut([r(20000, 30000)], 60000)).toBeNull()
    expect(validateCutOut([r(0, 10000)], 60000)).toBeNull()
    expect(validateCutOut([r(50000, 60000)], 60000)).toBeNull()
  })
  it('needs a cut, and not too many', () => {
    expect(validateCutOut([], 60000)).toMatch(/at least one/)
    expect(
      validateCutOut(
        Array.from({ length: MAX_CUTS + 1 }, (_, i) => r(i * 2000, i * 2000 + 1000)),
        600000
      )
    ).toMatch(/At most/)
  })
  it('rejects bad ranges', () => {
    expect(validateCutOut([r(-1, 5000)], 60000)).toMatch(/before the beginning/)
    expect(validateCutOut([r(5000, 5000)], 60000)).toMatch(/after the start/)
    expect(validateCutOut([r(5000, 70000)], 60000)).toMatch(/past the end/)
    expect(validateCutOut([r(NaN, 5000)], 60000)).toMatch(/both times/)
  })
  it('rejects cutting everything or leaving slivers', () => {
    expect(validateCutOut([r(0, 60000)], 60000)).toMatch(/Nothing would be left/)
    expect(validateCutOut([r(200, 30000)], 60000)).toMatch(/shorter/)
    expect(validateCutOut([r(10000, 20000), r(20200, 30000)], 60000)).toMatch(/shorter/)
    expect(validateCutOut([r(10000, 59800)], 60000)).toMatch(/shorter/)
  })
  it('skips the leftover checks when the length is unknown', () => {
    expect(validateCutOut([r(20000, 30000)], null)).toBeNull()
  })
})

describe('cutSkipTarget', () => {
  const cuts = [r(20000, 30000), r(40000, 45000)]
  it('jumps to the end of the cut being played', () => {
    expect(cutSkipTarget(cuts, 20000)).toBe(30000)
    expect(cutSkipTarget(cuts, 25000)).toBe(30000)
    expect(cutSkipTarget(cuts, 41000)).toBe(45000)
  })
  it('leaves the rest alone', () => {
    expect(cutSkipTarget(cuts, 19999)).toBeNull()
    expect(cutSkipTarget(cuts, 30000)).toBeNull()
    expect(cutSkipTarget([], 5)).toBeNull()
  })
})

describe('cutBetween', () => {
  it('orders and clamps the marks', () => {
    expect(cutBetween(30000, 20000, 60000)).toEqual(r(20000, 30000))
    expect(cutBetween(-5, 70000, 60000)).toEqual(r(0, 60000))
    expect(cutBetween(5000, 5000, 60000)).toBeNull()
  })
})

describe('snapCut', () => {
  it('reaches the end or the beginning instead of leaving a sliver', () => {
    expect(snapCut(r(10000, 59800), 60000)).toEqual(r(10000, 60000))
    expect(snapCut(r(200, 30000), 60000)).toEqual(r(0, 30000))
  })
  it('leaves proper pieces alone', () => {
    expect(snapCut(r(10000, 59000), 60000)).toEqual(r(10000, 59000))
    expect(snapCut(r(0, 30000), 60000)).toEqual(r(0, 30000))
  })
  it('is used when marking a range near the end', () => {
    expect(cutBetween(10000, 59700, 60000)).toEqual(r(10000, 60000))
  })
})

describe('moveCutEdge', () => {
  const cuts = [r(20000, 30000), r(40000, 45000)]
  it('moves one edge and leaves the other cuts alone', () => {
    expect(moveCutEdge(cuts, 0, 'startMs', 15000, 60000)).toEqual([r(15000, 30000), r(40000, 45000)])
    expect(moveCutEdge(cuts, 1, 'endMs', 50000, 60000)).toEqual([r(20000, 30000), r(40000, 50000)])
  })
  it('stays inside the video and keeps a minimum length', () => {
    expect(moveCutEdge(cuts, 0, 'startMs', -5, 60000)[0]).toEqual(r(0, 30000))
    expect(moveCutEdge(cuts, 0, 'endMs', 99999, 60000)[0]).toEqual(r(20000, 60000))
    expect(moveCutEdge(cuts, 0, 'startMs', 40000, 60000)[0]).toEqual(r(30000 - MIN_CUT_MS, 30000))
    expect(moveCutEdge(cuts, 0, 'endMs', 1000, 60000)[0]).toEqual(r(20000, 20000 + MIN_CUT_MS))
  })
  it('ignores a missing cut', () => {
    expect(moveCutEdge(cuts, 5, 'startMs', 1, 60000)).toBe(cuts)
  })
})
