import { describe, expect, it } from 'vitest'
import { activeWordIndex, glossaryPieces, revealedCueIndex, shiftCues } from './captions'
import { splitWords } from './words'

const cues = [
  { startMs: 0, endMs: 2000, text: 'Hello there' },
  { startMs: 2000, endMs: 5000, text: 'Open the dashboard' },
  { startMs: 6000, endMs: 8000, text: 'Bye' }
]

describe('shiftCues', () => {
  it('moves every line, never before zero', () => {
    expect(shiftCues(cues, 500)[0]).toMatchObject({ startMs: 500, endMs: 2500 })
    expect(shiftCues(cues, -1000)[0]).toMatchObject({ startMs: 0, endMs: 1000 })
    expect(shiftCues(cues, 0)).toBe(cues)
  })
})

describe('revealedCueIndex', () => {
  it('shows the last finished line', () => {
    expect(revealedCueIndex(cues, 1000)).toBe(-1)
    expect(revealedCueIndex(cues, 3000)).toBe(0)
    expect(revealedCueIndex(cues, 5500)).toBe(1)
    expect(revealedCueIndex(cues, 9000)).toBe(2)
  })
})

describe('activeWordIndex', () => {
  const pieces = splitWords('Open the dashboard', 'en')
  it('walks through the words, weighted by length', () => {
    const at = (ms: number) => pieces[activeWordIndex(pieces, cues[1]!, ms)]?.text
    expect(at(2100)).toBe('Open')
    expect(at(3000)).toBe('the')
    expect(at(4900)).toBe('dashboard')
    expect(activeWordIndex(pieces, cues[1]!, 5000)).toBe(-1)
  })
})

describe('glossaryPieces', () => {
  it('marks the pieces of a multi-word term', () => {
    const pieces = splitWords('Open the video lesson now', 'en')
    const marks = glossaryPieces(pieces, [{ source: 'video lesson', target: 'មេរៀនវីដេអូ', doNotTranslate: false, caseSensitive: false }])
    expect(
      pieces
        .filter((_, i) => marks[i])
        .map((p) => p.text)
        .join('')
    ).toBe('video lesson')
  })
})
