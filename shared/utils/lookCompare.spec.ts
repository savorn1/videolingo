import { describe, expect, it } from 'vitest'
import { containRect, dividerAt } from './lookCompare'

describe('containRect', () => {
  it('letterboxes a wide picture in a tall box, and pillarboxes a tall one in a wide box', () => {
    expect(containRect(400, 400, 1920, 1080)).toEqual({ x: 0, y: 87.5, w: 400, h: 225 })
    expect(containRect(1600, 900, 1080, 1920)).toMatchObject({ y: 0, h: 900 })
    expect(containRect(1600, 900, 1080, 1920).x).toBeCloseTo((1600 - 506.25) / 2)
  })
  it('fills the box while the picture size is unknown', () => {
    expect(containRect(400, 300, 0, 0)).toEqual({ x: 0, y: 0, w: 400, h: 300 })
  })
})

describe('dividerAt', () => {
  it('follows the pointer, kept inside the edges', () => {
    expect(dividerAt(150, 100, 200)).toBe(0.25)
    expect(dividerAt(0, 100, 200)).toBe(0.02)
    expect(dividerAt(999, 100, 200)).toBe(0.98)
  })
})
