import { describe, expect, it } from 'vitest'
import { aiChaptersToMarkers, pickAiChapters } from './aiChapterMarkers'

const gen = (lang: string, chapters: { startSeconds: number; title: string }[]) => ({ type: 'CHAPTERS', outputLanguage: lang, content: { chapters } })

describe('pickAiChapters', () => {
  it("prefers the video's own language, else the first", () => {
    const en = gen('en', [{ startSeconds: 0, title: 'Hello' }])
    const km = gen('km', [{ startSeconds: 0, title: 'សួស្តី' }])
    expect(pickAiChapters([km, en], 'en')[0]!.title).toBe('Hello')
    expect(pickAiChapters([km, en], 'fr')[0]!.title).toBe('សួស្តី')
    expect(pickAiChapters([{ type: 'SUMMARY', outputLanguage: 'en', content: {} }], 'en')).toEqual([])
  })
})

describe('aiChaptersToMarkers', () => {
  it('adds each chapter inside the video once, in time order, skipping ones already marked', () => {
    const chapters = [
      { startSeconds: 60, title: 'Numbers' },
      { startSeconds: 0, title: ' Greetings ' },
      { startSeconds: 60.4, title: 'Numbers again' },
      { startSeconds: 500, title: 'Past the end' },
      { startSeconds: 120, title: 'Practice' }
    ]
    expect(aiChaptersToMarkers(chapters, [{ atMs: 120_500, chapter: true }], 300_000)).toEqual([
      { atMs: 0, label: 'Greetings' },
      { atMs: 60_000, label: 'Numbers' }
    ])
  })
  it('ignores ordinary markers when deciding what is already there', () => {
    expect(aiChaptersToMarkers([{ startSeconds: 5, title: 'A' }], [{ atMs: 5000, chapter: false }], 60_000)).toHaveLength(1)
  })
})
