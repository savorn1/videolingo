import { describe, expect, it } from 'vitest'
import { snapAxis } from './layerSnap'

describe('snapAxis', () => {
  it('snaps centre-to-centre when close enough', () => {
    const r = snapAxis(0.502, 0.1, [0.5], [])
    expect(r.value).toBe(0.5)
    expect(r.guide).toBe(0.5)
  })

  it('leaves the raw value alone when nothing is close', () => {
    const r = snapAxis(0.3, 0.1, [0.5], [0.8])
    expect(r.value).toBe(0.3)
    expect(r.guide).toBeNull()
  })

  it("snaps my left edge to another layer's edge", () => {
    // My half-width 0.1, raw centre 0.302 → my left edge is at 0.202, close to 0.2.
    const r = snapAxis(0.302, 0.1, [], [0.2])
    expect(r.value).toBeCloseTo(0.3) // centre that puts my left edge exactly on 0.2
    expect(r.guide).toBe(0.2)
  })

  it("snaps my right edge to another layer's edge", () => {
    // My half-width 0.1, raw centre 0.698 → my right edge is at 0.798, close to 0.8.
    const r = snapAxis(0.698, 0.1, [], [0.8])
    expect(r.value).toBeCloseTo(0.7)
    expect(r.guide).toBe(0.8)
  })

  it('picks whichever candidate is closest when several are in range', () => {
    // Centre-to-centre at 0.5 is exact; an edge match nearby is farther off — centre wins.
    const r = snapAxis(0.5005, 0.1, [0.5], [0.39])
    expect(r.guide).toBe(0.5)
  })

  it('respects a custom tolerance', () => {
    expect(snapAxis(0.52, 0.1, [0.5], [], 0.01).guide).toBeNull()
    expect(snapAxis(0.52, 0.1, [0.5], [], 0.05).guide).toBe(0.5)
  })
})
