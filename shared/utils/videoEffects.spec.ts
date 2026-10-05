import { describe, expect, it } from 'vitest'
import {
  MAX_FADE_MS,
  NO_FADE,
  VIDEO_EFFECTS,
  ZOOM_AMOUNT,
  describeEffect,
  describeFade,
  effectCssFilter,
  effectRequest,
  fadeOpacityAt,
  fadeRequest,
  isNoFade,
  validateFade,
  zoomScaleAt
} from './videoEffects'

describe('effects', () => {
  it('lists none first and describes the rest', () => {
    expect(VIDEO_EFFECTS[0]!.value).toBe('NONE')
    for (const e of VIDEO_EFFECTS.slice(1)) expect(describeEffect(e.value)).toBeTruthy()
    expect(describeEffect('NONE')).toBeNull()
  })
  it('leaves none out of the request', () => {
    expect(effectRequest('NONE')).toBeUndefined()
    expect(effectRequest('GLITCH')).toBe('GLITCH')
  })
  it('previews old film with a filter only', () => {
    expect(effectCssFilter('OLD_FILM')).toContain('sepia')
    expect(effectCssFilter('GLITCH')).toBe('')
  })
})

describe('fades', () => {
  it('treats zero fades as none and sends nothing for them', () => {
    expect(isNoFade(NO_FADE)).toBe(true)
    expect(isNoFade(null)).toBe(true)
    expect(fadeRequest({ ...NO_FADE, color: 'WHITE' })).toBeNull()
    expect(fadeRequest({ inMs: 999.6, outMs: 0, color: 'WHITE' })).toEqual({ inMs: 1000, outMs: 0, color: 'WHITE' })
  })
  it('keeps each fade short and both inside the clip', () => {
    expect(validateFade({ inMs: 1000, outMs: 1000, color: 'BLACK' }, 2000)).toBeNull()
    expect(validateFade({ inMs: MAX_FADE_MS + 1, outMs: 0, color: 'BLACK' }, null)).toMatch(/between 0 and 5 s/)
    expect(validateFade({ inMs: 1500, outMs: 1000, color: 'BLACK' }, 2000)).toMatch(/longer than the clip/)
  })
  it('describes them like the server does', () => {
    expect(describeFade({ inMs: 1000, outMs: 500, color: 'WHITE' })).toBe('fade in 1 s, fade out 0.5 s (white)')
    expect(describeFade({ inMs: 0, outMs: 2000, color: 'BLACK' })).toBe('fade out 2 s')
    expect(describeFade(NO_FADE)).toBeNull()
  })
})

describe('preview', () => {
  const fade = { inMs: 1000, outMs: 2000, color: 'BLACK' as const }
  it('covers the picture fully at the edges and not in the middle', () => {
    expect(fadeOpacityAt(10_000, 10_000, 20_000, fade)).toBe(1)
    expect(fadeOpacityAt(10_500, 10_000, 20_000, fade)).toBe(0.5)
    expect(fadeOpacityAt(15_000, 10_000, 20_000, fade)).toBe(0)
    expect(fadeOpacityAt(19_000, 10_000, 20_000, fade)).toBe(0.5)
    expect(fadeOpacityAt(20_000, 10_000, 20_000, fade)).toBe(1)
  })
  it('shows nothing outside the clip or without a fade', () => {
    expect(fadeOpacityAt(5_000, 10_000, 20_000, fade)).toBe(0)
    expect(fadeOpacityAt(10_000, 10_000, 20_000, NO_FADE)).toBe(0)
  })
  it('zooms in over the clip, or out from close up', () => {
    expect(zoomScaleAt(0, 0, 10_000, 'ZOOM_IN')).toBe(1)
    expect(zoomScaleAt(5_000, 0, 10_000, 'ZOOM_IN')).toBe(1 + ZOOM_AMOUNT / 2)
    expect(zoomScaleAt(10_000, 0, 10_000, 'ZOOM_IN')).toBe(1 + ZOOM_AMOUNT)
    expect(zoomScaleAt(0, 0, 10_000, 'ZOOM_OUT')).toBe(1 + ZOOM_AMOUNT)
    expect(zoomScaleAt(20_000, 0, 10_000, 'ZOOM_OUT')).toBe(1)
    expect(zoomScaleAt(5_000, 0, 10_000, 'GLITCH')).toBe(1)
  })
})
