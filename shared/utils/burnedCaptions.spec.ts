import { describe, expect, it } from 'vitest'
import { DEFAULT_CAPTIONS, captionAt, captionRequest, pairedSecond, validateCaptions } from './burnedCaptions'

describe('validateCaptions', () => {
  it('is fine when off or complete', () => {
    expect(validateCaptions(null)).toBeNull()
    expect(validateCaptions({ ...DEFAULT_CAPTIONS, transcriptId: 1, secondTranscriptId: 2 })).toBeNull()
  })
  it('needs a transcript, a different second one, and a size in range', () => {
    expect(validateCaptions(DEFAULT_CAPTIONS)).toMatch(/pick a transcript/)
    expect(validateCaptions({ ...DEFAULT_CAPTIONS, transcriptId: 1, secondTranscriptId: 1 })).toMatch(/different/)
    expect(validateCaptions({ ...DEFAULT_CAPTIONS, transcriptId: 1, sizePct: 12 })).toMatch(/between 3% and 10%/)
  })
  it('sends nothing when off, and a copy otherwise', () => {
    const c = { ...DEFAULT_CAPTIONS, transcriptId: 3 }
    expect(captionRequest(null)).toBeNull()
    expect(captionRequest(c)).toEqual(c)
    expect(captionRequest(c)).not.toBe(c)
  })
})

describe('pairing and the preview', () => {
  const first = [
    { startMs: 0, endMs: 2000, text: 'Hello there' },
    { startMs: 2000, endMs: 5000, text: 'How are you?' }
  ]
  const second = [
    { startMs: 0, endMs: 1000, text: 'Bonjour' },
    { startMs: 900, endMs: 2100, text: 'à vous' },
    { startMs: 2200, endMs: 4800, text: 'Comment ça va ?' }
  ]
  it('pairs like the server', () => {
    expect(pairedSecond(first[0]!, second)).toBe('Bonjour à vous')
    expect(pairedSecond({ startMs: 1000, endMs: 1200, text: 'x' }, [{ startMs: 0, endMs: 9000, text: 'Long' }])).toBe('Long')
    expect(pairedSecond(first[0]!, [])).toBeNull()
  })
  it('shows the line being spoken, and nothing between lines', () => {
    expect(captionAt(first, second, 2500)).toEqual({ text: 'How are you?', second: 'Comment ça va ?' })
    expect(captionAt(first, [], 500)).toEqual({ text: 'Hello there', second: null })
    expect(captionAt(first, second, 6000)).toBeNull()
  })
})
