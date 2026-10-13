import { describe, expect, it } from 'vitest'
import { isMovingLayer, layerAt } from './layerMotion'

const l = { x: 0.2, y: 0.2, startMs: 1000, endMs: 3000, toX: 0.8, toY: 0.6, toScale: 2 }

describe('layerAt', () => {
  it('moves evenly from its place to the new one across its time', () => {
    expect(layerAt(l, 1000, 10_000)).toEqual({ x: 0.2, y: 0.2, scale: 1 })
    const mid = layerAt(l, 2000, 10_000)
    expect(mid.x).toBeCloseTo(0.5)
    expect(mid.y).toBeCloseTo(0.4)
    expect(mid.scale).toBeCloseTo(1.5)
    expect(layerAt(l, 9000, 10_000)).toEqual({ x: 0.8, y: 0.6, scale: 2 })
  })
  it('runs to the end of the video when the layer does', () => {
    expect(layerAt({ ...l, endMs: null }, 5500, 10_000).scale).toBeCloseTo(1.5)
  })
  it('keeps a still layer still', () => {
    const still = { x: 0.3, y: 0.7, startMs: 0, endMs: 2000 }
    expect(isMovingLayer(still)).toBe(false)
    expect(isMovingLayer(l)).toBe(true)
    expect(layerAt(still, 1000, 2000)).toEqual({ x: 0.3, y: 0.7, scale: 1 })
  })
})
