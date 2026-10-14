import { describe, expect, it } from 'vitest'
import { cardRequest, cardsProblem, chapterProblem, chaptersForPart, highlightTitle, paletteFromPixels, tidyChapters } from './audioVideoExtras'

describe('chapters', () => {
  it('are tidied from what a file holds and checked like the server', () => {
    const tidy = tidyChapters([
      { startMs: 60_000, title: '  Verbs ' },
      { startMs: 0, title: 'Welcome' },
      { startMs: 62_000, title: 'Too close' },
      { startMs: 90_000, title: '' }
    ])
    expect(tidy).toEqual([
      { startMs: 0, title: 'Welcome' },
      { startMs: 60_000, title: 'Verbs' }
    ])
    expect(chapterProblem(tidy)).toBeNull()
    expect(
      chapterProblem([
        { startMs: 0, title: 'A' },
        { startMs: 3000, title: 'B' }
      ])
    ).toMatch(/5 s apart/)
    expect(chapterProblem([{ startMs: 0, title: ' ' }])).toMatch(/write its title/)
  })

  it('follow a part of the recording, the running one shown from its start', () => {
    const all = [
      { startMs: 0, title: 'Welcome' },
      { startMs: 600_000, title: 'Verbs' },
      { startMs: 900_000, title: 'Practice' }
    ]
    expect(chaptersForPart(all, { startMs: 500_000, endMs: 1_000_000 })).toEqual([
      { startMs: 0, title: 'Welcome' },
      { startMs: 100_000, title: 'Verbs' },
      { startMs: 400_000, title: 'Practice' }
    ])
    // A chapter starting right at the part's start isn't doubled by the one before it.
    expect(chaptersForPart(all, { startMs: 600_000, endMs: 900_000 })).toEqual([{ startMs: 0, title: 'Verbs' }])
    expect(chaptersForPart(all, null)).toBe(all)
  })
})

describe('colours from the cover', () => {
  const pixels = (...colours: [number, number, number, number][]) => colours.flatMap(([r, g, b, n]) => Array.from({ length: n }, () => [r, g, b, 255]).flat())

  it('makes a dark background from the main colour and a bright accent from a lively one', () => {
    const { background, accent } = paletteFromPixels(pixels([30, 60, 140, 80], [240, 120, 20, 20]))
    const lum = (h: string) => {
      const n = parseInt(h.slice(1), 16)
      return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
    }
    expect(lum(background)).toBeLessThan(0.2)
    // Still blue-ish.
    expect(parseInt(background.slice(5, 7), 16)).toBeGreaterThan(parseInt(background.slice(1, 3), 16))
    expect(lum(accent)).toBeGreaterThanOrEqual(0.6)
    expect(parseInt(accent.slice(1, 3), 16)).toBeGreaterThan(parseInt(accent.slice(5, 7), 16)) // orange-ish
  })

  it('falls back to white for a grey picture, and to the defaults for an empty one', () => {
    expect(paletteFromPixels(pixels([128, 128, 128, 10])).accent).toBe('#ffffff')
    expect(paletteFromPixels([])).toEqual({ background: '#111827', accent: '#ffffff' })
  })
})

describe('highlight and cards', () => {
  it('names the highlight within the title limit', () => {
    expect(highlightTitle('Lesson 4')).toBe('Lesson 4 (highlight)')
    expect(highlightTitle('x'.repeat(200))).toHaveLength(200)
  })

  it('checks the cards and leaves out an empty one', () => {
    expect(cardsProblem({ text: 'Welcome', seconds: 3 }, { text: '', seconds: 99 })).toBeNull()
    expect(cardsProblem({ text: 'Welcome', seconds: 8 }, { text: '', seconds: 3 })).toMatch(/Intro card: it lasts 1–6 s/)
    expect(cardRequest({ text: ' Thanks ', seconds: 2.5 })).toEqual({ text: 'Thanks', durationMs: 2500 })
    expect(cardRequest({ text: '', seconds: 3 })).toBeUndefined()
  })
})
