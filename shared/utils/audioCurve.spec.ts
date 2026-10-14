import { describe, expect, it } from 'vitest'
import { addCurvePoint, curveGainAt, curveProblem, dipPoints, MAX_CURVE_POINTS, moveCurvePoint, previewGainAt } from './audioEdit'

const curve = [
  { atMs: 1000, gain: 1 },
  { atMs: 3000, gain: 0 }
]

describe('volume curve', () => {
  it('is flat outside the points and a straight line between', () => {
    expect(curveGainAt([], 500)).toBe(1)
    expect(curveGainAt(curve, 0)).toBe(1)
    expect(curveGainAt(curve, 2000)).toBeCloseTo(0.5)
    expect(curveGainAt(curve, 5000)).toBe(0)
  })

  it('adds points in time order, replacing one close by, and stops when full', () => {
    expect(addCurvePoint(curve, 2000, 0.4, 10_000).map((p) => p.atMs)).toEqual([1000, 2000, 3000])
    expect(addCurvePoint(curve, 1050, 0.3, 10_000)).toEqual([
      { atMs: 1050, gain: 0.3 },
      { atMs: 3000, gain: 0 }
    ])
    expect(addCurvePoint([], 500, 5, 10_000)).toEqual([{ atMs: 500, gain: 2 }])
    const full = Array.from({ length: MAX_CURVE_POINTS }, (_, i) => ({ atMs: i * 1000, gain: 1 }))
    expect(addCurvePoint(full, 500, 1, 60_000)).toBe(full)
  })

  it('moves a point only between its neighbours', () => {
    expect(moveCurvePoint(curve, 0, 5000, 0.5, 10_000)[0]).toEqual({ atMs: 2999, gain: 0.5 })
    expect(moveCurvePoint(curve, 1, 500, 1, 10_000)[1]!.atMs).toBe(1001)
  })

  it('dips under a stretch and comes back', () => {
    const dip = dipPoints([], { startMs: 2000, endMs: 4000 }, 0.3, 10_000)
    expect(dip).toEqual([
      { atMs: 1700, gain: 1 },
      { atMs: 2000, gain: 0.3 },
      { atMs: 4000, gain: 0.3 },
      { atMs: 4300, gain: 1 }
    ])
    expect(curveProblem(dip)).toBeNull()
    expect(curveProblem([...curve].reverse())).toMatch(/time order/)
  })

  it('is heard in the live preview', () => {
    const s = { volume: 1, mutes: [], fadeInMs: 0, fadeOutMs: 0, speed: 1, volumeCurve: curve }
    expect(previewGainAt(s, 10_000, 2000)).toBeCloseTo(0.5)
    expect(previewGainAt({ ...s, volumeCurve: undefined }, 10_000, 2000)).toBe(1)
  })
})
