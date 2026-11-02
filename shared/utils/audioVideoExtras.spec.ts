import { describe, expect, it } from 'vitest'
import {
  cardRequest,
  cardsProblem,
  chapterProblem,
  chaptersForPart,
  highlightTitle,
  newChapterStart,
  moveRange,
  numberTitles,
  orderRecordings,
  parseChapterList,
  replaceInTitles,
  titlePatternProblem,
  sanitizeTitleNumbering,
  titleTwins,
  paletteFromPixels,
  tidyChapters
} from './audioVideoExtras'

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

describe('adding a chapter', () => {
  it('starts at 0:00, then a minute after the last, inside the recording', () => {
    expect(newChapterStart([], 600_000)).toBe(0)
    expect(newChapterStart([{ startMs: 0, title: 'A' }], 600_000)).toBe(60_000)
    expect(newChapterStart([{ startMs: 580_000, title: 'A' }], 600_000)).toBe(595_000)
    expect(newChapterStart([{ startMs: 0, title: 'A' }], null)).toBe(60_000)
  })
})

describe('moving the highlight', () => {
  it('keeps its length and stays inside the recording', () => {
    const r = { startMs: 30_000, endMs: 75_000 }
    expect(moveRange(r, 10_000, 120_000)).toEqual({ startMs: 10_000, endMs: 55_000 })
    expect(moveRange(r, 100_000, 120_000)).toEqual({ startMs: 75_000, endMs: 120_000 })
    expect(moveRange(r, -5, 120_000)).toEqual({ startMs: 0, endMs: 45_000 })
  })
})

describe('a pasted chapter list', () => {
  it('reads the usual ways of writing one, in time order, and counts the lines it left out', () => {
    const { chapters, skipped } = parseChapterList(
      ['Chapters:', '0:00 Welcome', '- 01:05:30 - Practice', '[12:30] Verbs', 'Numbers (4:05)', '', '3 things to know', '7:75 Not a time', '9:00'].join('\n')
    )
    expect(chapters).toEqual([
      { startMs: 0, title: 'Welcome' },
      { startMs: 245_000, title: 'Numbers' },
      { startMs: 750_000, title: 'Verbs' },
      { startMs: 3_930_000, title: 'Practice' }
    ])
    expect(skipped).toBe(4)
  })
  it('keeps fractions of a second and cuts long titles', () => {
    expect(parseChapterList(`1:23.5 ${'x'.repeat(100)}`).chapters).toEqual([{ startMs: 83_500, title: 'x'.repeat(80) }])
  })
})

describe('order and numbering of a batch', () => {
  const rec = (name: string, track: number | null, disc: number | null = null) => ({ name, track, disc })
  it('orders by track (disc first, unnumbered last in their order) or by file name as read', () => {
    const items = [rec('b.mp3', null), rec('x.mp3', 2), rec('a.mp3', null), rec('y.mp3', 1, 2), rec('z.mp3', 5, 1)]
    expect(orderRecordings(items, 'TRACK').map((i) => i.name)).toEqual(['x.mp3', 'z.mp3', 'y.mp3', 'b.mp3', 'a.mp3'])
    const names = [rec('Lesson 10.mp3', null), rec('lesson 2.mp3', null), rec('Lesson 1.mp3', null)]
    expect(orderRecordings(names, 'NAME').map((i) => i.name)).toEqual(['Lesson 1.mp3', 'lesson 2.mp3', 'Lesson 10.mp3'])
  })
  it('numbers titles with a pattern, padding {nn} to the widest number', () => {
    expect(numberTitles(['Greetings', 'Food'], 'Episode {n}: {title}', 9)).toEqual(['Episode 9: Greetings', 'Episode 10: Food'])
    expect(numberTitles(['A', 'B'], 'Lesson {nn} — {title}')).toEqual(['Lesson 01 — A', 'Lesson 02 — B'])
    expect(numberTitles(['A'], 'Part {n}')).toEqual(['Part 1'])
  })
  it('never numbers a title twice: numbering again renumbers, and file-name numbers shared by all go', () => {
    const once = numberTitles(['Greetings', 'Food'], 'Episode {n}: {title}')
    expect(numberTitles([once[1]!, once[0]!], 'Episode {n}: {title}')).toEqual(['Episode 1: Food', 'Episode 2: Greetings'])
    expect(numberTitles(['01 Greetings', '02 - Food'], '{n}. {title}')).toEqual(['1. Greetings', '2. Food'])
    // Not every title starts with a number, or there is only one: they are titles, not numbering.
    expect(numberTitles(['100 words', 'Food'], '{n}. {title}')).toEqual(['1. 100 words', '2. Food'])
    expect(numberTitles(['100 words'], '{n}. {title}')).toEqual(['1. 100 words'])
  })
  it('keeps titles within 200 characters and checks the pattern', () => {
    expect(numberTitles(['x'.repeat(200)], '{n}. {title}')[0]).toHaveLength(200)
    expect(titlePatternProblem('{title}')).toMatch(/\{n\}/)
    expect(titlePatternProblem(' {n} ')).toMatch(/words/)
    expect(titlePatternProblem('{nn} {title}')).toBeNull()
  })
})

describe('find and replace in titles', () => {
  it('replaces every match as written, case-blind unless asked, and counts the titles changed', () => {
    const titles = ['Lesson 1: lesson plan', 'Episode (2)', 'Intro']
    expect(replaceInTitles(titles, 'lesson', 'Lecture')).toEqual({ titles: ['Lecture 1: Lecture plan', 'Episode (2)', 'Intro'], changed: 1 })
    expect(replaceInTitles(titles, 'lesson', 'Lecture', true).titles[0]).toBe('Lesson 1: Lecture plan')
    // Not a pattern: brackets are just characters; "$&" in the replacement is kept as written.
    expect(replaceInTitles(titles, '(2)', '$&!').titles[1]).toBe('Episode $&!')
    expect(replaceInTitles(['Part  one '], 'one', '')).toEqual({ titles: ['Part'], changed: 1 })
    expect(replaceInTitles(titles, '', 'x').changed).toBe(0)
  })
})

describe('titles that read the same', () => {
  it('points each to the first other one, case and spacing aside', () => {
    expect(titleTwins(['Intro', 'Lesson', ' intro ', 'Lesson', 'Outro'])).toEqual([2, 3, 0, 1, null])
    expect(titleTwins(['Lesson  one', 'lesson one'])).toEqual([1, 0])
  })
  it('leaves out empty titles', () => {
    expect(titleTwins(['', ' ', 'A'])).toEqual([null, null, null])
  })
})

describe('a remembered numbering', () => {
  it('keeps a usable pattern and a start within 0–9999', () => {
    expect(sanitizeTitleNumbering({ pattern: 'Episode {n}: {title}', start: 12 })).toEqual({ pattern: 'Episode {n}: {title}', start: 12 })
    expect(sanitizeTitleNumbering({ pattern: '{nn} {title}', start: 99_999 })).toEqual({ pattern: '{nn} {title}', start: 9999 })
    expect(sanitizeTitleNumbering({ pattern: '{n}. {title}', start: 'x' })).toEqual({ pattern: '{n}. {title}', start: 1 })
  })
  it('drops what cannot be used', () => {
    expect(sanitizeTitleNumbering(null)).toBeNull()
    expect(sanitizeTitleNumbering('Episode {n}')).toBeNull()
    expect(sanitizeTitleNumbering({ pattern: 'no number {title}' })).toBeNull()
    expect(sanitizeTitleNumbering({ pattern: 7 })).toBeNull()
  })
})
