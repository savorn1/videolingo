import { describe, expect, it } from 'vitest'
import { ANIMATION_SPEEDS, DEFAULT_ANIMATION_SPEED, formatAnimationSpeed, sanitizeAnimationSpeed } from './animationSpeed'

describe('sanitizeAnimationSpeed', () => {
  it('keeps the offered speeds, as numbers or stored strings', () => {
    for (const s of ANIMATION_SPEEDS) {
      expect(sanitizeAnimationSpeed(s)).toBe(s)
      expect(sanitizeAnimationSpeed(String(s))).toBe(s)
    }
  })
  it('falls back to the normal speed for anything else', () => {
    for (const bad of [null, undefined, '', 'fast', 3, 0, -1, NaN, {}]) expect(sanitizeAnimationSpeed(bad)).toBe(DEFAULT_ANIMATION_SPEED)
  })
})

describe('formatAnimationSpeed', () => {
  it('writes it as a multiplier', () => {
    expect(formatAnimationSpeed(0.5)).toBe('0.5×')
    expect(formatAnimationSpeed(1)).toBe('1×')
    expect(formatAnimationSpeed(1.5)).toBe('1.5×')
  })
})
