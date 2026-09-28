import { describe, expect, it } from 'vitest'
import { clampZoom, cueSnapTargets, msToPx, pxToMs, snapMs } from './timeline'

describe('msToPx / pxToMs', () => {
  it('convert between milliseconds and pixels at a given zoom', () => {
    expect(msToPx(1000, 60)).toBe(60)
    expect(msToPx(2500, 60)).toBe(150)
    expect(pxToMs(60, 60)).toBe(1000)
    expect(pxToMs(150, 60)).toBe(2500)
  })
  it('round-trip', () => {
    expect(pxToMs(msToPx(4321, 37), 37)).toBeCloseTo(4321, 5)
  })
})

describe('clampZoom', () => {
  it('keeps zoom within the min/max bounds', () => {
    expect(clampZoom(60)).toBe(60)
    expect(clampZoom(1)).toBe(10)
    expect(clampZoom(9999)).toBe(400)
  })
})

describe('snapMs', () => {
  const targets = [1000, 5000, 5200]

  it('snaps to the nearest target within tolerance', () => {
    expect(snapMs(1050, targets, 100)).toBe(1000)
    expect(snapMs(5150, targets, 100)).toBe(5200)
  })
  it('leaves the candidate unchanged when nothing is close enough', () => {
    expect(snapMs(3000, targets, 100)).toBe(3000)
  })
  it('picks the closest of two targets both within tolerance', () => {
    expect(snapMs(5120, targets, 200)).toBe(5200)
  })
})

describe('cueSnapTargets', () => {
  it('flattens each cue into its start and end', () => {
    expect(
      cueSnapTargets([
        { startMs: 0, endMs: 1000 },
        { startMs: 1500, endMs: 2000 }
      ])
    ).toEqual([0, 1000, 1500, 2000])
  })
})
