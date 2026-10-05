import { describe, expect, it } from 'vitest'
import {
  cardsLength,
  cardsRequest,
  describeCards,
  describePip,
  describeSpeedRange,
  newBlurBox,
  pipRequest,
  rampedLength,
  validateBlurs,
  validateCards,
  validatePip,
  validateSpeedRange
} from './clipExtras'

describe('blurred areas', () => {
  it('start as a quarter-size box in the middle and must stay inside the picture', () => {
    expect(newBlurBox(1920, 1080)).toEqual({ x: 720, y: 405, w: 480, h: 270 })
    expect(validateBlurs([newBlurBox(1920, 1080)], 1920, 1080)).toBeNull()
    expect(validateBlurs([{ x: 0, y: 0, w: 4, h: 50 }], 1920, 1080)).toMatch(/too small/)
    expect(validateBlurs([{ x: 1900, y: 0, w: 50, h: 50 }], 1920, 1080)).toMatch(/edge/)
    expect(
      validateBlurs(
        Array.from({ length: 6 }, () => newBlurBox(100, 100)),
        100,
        100
      )
    ).toMatch(/At most 5/)
  })
})

describe('speed range', () => {
  const slow = { startMs: 1000, endMs: 3000, speed: 0.5 }
  it('is checked like the server does', () => {
    expect(validateSpeedRange(null, 5000)).toBeNull()
    expect(validateSpeedRange(slow, 5000)).toBeNull()
    expect(validateSpeedRange({ ...slow, speed: 0.3 }, 5000)).toMatch(/speed/)
    expect(validateSpeedRange({ ...slow, endMs: 1200 }, 5000)).toMatch(/at least 0.5 s/)
    expect(validateSpeedRange(slow, 2000)).toMatch(/past the end/)
  })
  it('changes the length and is described', () => {
    expect(rampedLength(10_000, slow)).toBe(12_000)
    expect(rampedLength(10_000, { startMs: 0, endMs: 10_000, speed: 2 })).toBe(5000)
    expect(rampedLength(10_000, null)).toBe(10_000)
    expect(describeSpeedRange(slow)).toBe('slow motion 0.5× for 2 s')
  })
})

describe('picture in picture', () => {
  it('needs a video and a size in range, and sends only what the server needs', () => {
    const p = { videoId: 7, title: 'Teacher', thumbnailUrl: 'https://x/t.jpg', corner: 'TOP_RIGHT' as const, sizePct: 30 }
    expect(validatePip(p)).toBeNull()
    expect(validatePip({ ...p, videoId: null })).toMatch(/pick a video/)
    expect(validatePip({ ...p, sizePct: 60 })).toMatch(/between 15% and 50%/)
    expect(pipRequest(p)).toEqual({ videoId: 7, corner: 'TOP_RIGHT', sizePct: 30 })
    expect(pipRequest(null)).toBeNull()
    expect(describePip(p)).toBe('picture in picture (Teacher)')
  })
})

describe('cards', () => {
  const c = { intro: { text: 'Lesson 3', durationMs: 3000 }, outro: null, background: '#1e3a8a', color: '#ffffff', logoKey: null, logoUrl: 'https://x/l.png' }
  it('need a card with text, a length in range and colours', () => {
    expect(validateCards(c)).toBeNull()
    expect(validateCards({ ...c, intro: null })).toMatch(/intro or an outro/)
    expect(validateCards({ ...c, intro: { text: ' ', durationMs: 3000 } })).toMatch(/write its text/)
    expect(validateCards({ ...c, intro: { text: 'Hi', durationMs: 9000 } })).toMatch(/between 1 and 6 s/)
    expect(validateCards({ ...c, background: 'navy' })).toMatch(/colours/)
  })
  it('send no preview link, add their length and are described', () => {
    expect(cardsRequest(c)).toEqual({ intro: { text: 'Lesson 3', durationMs: 3000 }, outro: null, background: '#1e3a8a', color: '#ffffff', logoKey: null })
    expect(cardsRequest({ ...c, intro: null })).toBeNull()
    expect(cardsLength({ ...c, outro: { text: 'Bye', durationMs: 2000 } })).toBe(5000)
    expect(describeCards(c)).toBe('intro card')
  })
})
