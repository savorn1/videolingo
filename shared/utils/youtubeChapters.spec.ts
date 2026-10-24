import { describe, expect, it } from 'vitest'
import { youtubeChapters } from './youtubeChapters'

const m = (atMs: number, label: string, chapter = false) => ({ atMs, label, chapter })

describe('youtubeChapters', () => {
  it('lists the chapter markers from 0:00', () => {
    expect(youtubeChapters([m(65_000, 'Practice', true), m(3000, 'Welcome', true), m(30_000, 'Not a chapter')], 300_000)).toEqual({
      text: '0:00 Welcome\n1:05 Practice',
      count: 2,
      skipped: 0,
      problem: expect.stringContaining('at least 3')
    })
  })

  it('adds an Intro at 0:00, and leaves out ones too close to the one before or the end', () => {
    const r = youtubeChapters([m(20_000, 'Part one'), m(25_000, 'Too close'), m(60_000, 'Part two'), m(295_000, 'At the end')], 300_000)
    expect(r.text).toBe('0:00 Intro\n0:20 Part one\n1:00 Part two')
    expect(r).toMatchObject({ count: 3, skipped: 2, problem: null })
  })

  it('writes hours for a long video', () => {
    expect(youtubeChapters([m(0, 'A'), m(1_800_000, 'B'), m(3_700_000, 'C')], 4_000_000).text).toBe('0:00:00 A\n0:30:00 B\n1:01:40 C')
  })
})
