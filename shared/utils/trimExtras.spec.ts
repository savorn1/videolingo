import { describe, expect, it } from 'vitest'
import { describeExtras, extrasProblem, extrasRequest, isPlainExtras, newBlurBox, PLAIN_EXTRAS, sanitizeExtras, type TrimExtras } from './trimExtras'

const e = (patch: Partial<TrimExtras>): TrimExtras => ({ ...PLAIN_EXTRAS, ...patch })
const card = { text: 'Lesson 4', durationMs: 3000 }
const cards = { intro: card, outro: null, background: '#1e3a8a', color: '#ffffff', logoKey: null, logoName: null }

describe('blur boxes', () => {
  it('start as a quarter of the picture in the middle, and must stay inside it', () => {
    expect(newBlurBox(1280, 720)).toEqual({ x: 480, y: 270, w: 320, h: 180 })
    expect(extrasProblem(e({ blurs: [newBlurBox(1280, 720)] }), 1280, 720)).toBeNull()
    expect(extrasProblem(e({ blurs: [{ x: 1200, y: 0, w: 200, h: 100 }] }), 1280, 720)).toMatch(/inside the picture/)
    expect(extrasProblem(e({ blurs: [{ x: 0, y: 0, w: 4, h: 100 }] }), 1280, 720)).toMatch(/too small/)
    expect(extrasProblem(e({ blurs: Array.from({ length: 6 }, () => newBlurBox(1280, 720)) }), 1280, 720)).toMatch(/At most 5/)
  })
})

describe('picture in picture and cards', () => {
  it('need a video, a sensible size, and text and colours', () => {
    expect(extrasProblem(e({ pip: { videoId: null, videoTitle: null, corner: 'TOP_RIGHT', sizePct: 30 } }), 0, 0)).toMatch(/pick a video/)
    expect(extrasProblem(e({ pip: { videoId: 8, videoTitle: 'x', corner: 'TOP_RIGHT', sizePct: 60 } }), 0, 0)).toMatch(/between 15% and 50%/)
    expect(extrasProblem(e({ cards }), 0, 0)).toBeNull()
    expect(extrasProblem(e({ cards: { ...cards, intro: null } }), 0, 0)).toMatch(/intro or an outro/)
    expect(extrasProblem(e({ cards: { ...cards, intro: { text: ' ', durationMs: 3000 } } }), 0, 0)).toMatch(/write its text/)
    expect(extrasProblem(e({ cards: { ...cards, intro: { text: 'x', durationMs: 9000 } } }), 0, 0)).toMatch(/between 1 and 6 s/)
    expect(extrasProblem(e({ cards: { ...cards, color: 'white' } }), 0, 0)).toMatch(/colours/)
  })
})

describe('extrasRequest and describeExtras', () => {
  it('send only what is in use, without the names kept for the page', () => {
    expect(extrasRequest(PLAIN_EXTRAS)).toEqual({})
    const all = e({ blurs: [newBlurBox(100, 100)], pip: { videoId: 8, videoTitle: 'Teacher', corner: 'BOTTOM_RIGHT', sizePct: 30 }, cards })
    expect(extrasRequest(all)).toEqual({
      blurs: [{ x: 38, y: 38, w: 25, h: 25 }],
      pip: { videoId: 8, corner: 'BOTTOM_RIGHT', sizePct: 30 },
      cards: { intro: { text: 'Lesson 4', durationMs: 3000 }, outro: null, background: '#1e3a8a', color: '#ffffff', logoKey: null }
    })
    expect(describeExtras(all)).toBe('1 blurred area, picture in picture, intro card')
    expect(isPlainExtras(PLAIN_EXTRAS)).toBe(true)
  })
  it('reads old drafts', () => {
    expect(sanitizeExtras(undefined)).toEqual(PLAIN_EXTRAS)
  })
})
