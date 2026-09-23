import { describe, expect, it } from 'vitest'
import { formatTimestamp, parseSubtitles, parseTimestamp, segmentError, splitHighlight } from './subtitles'

describe('parseTimestamp', () => {
  it('reads SRT and VTT styles', () => {
    expect(parseTimestamp('00:01:02,500')).toBe(62_500)
    expect(parseTimestamp('01:02:03.456')).toBe(3_723_456)
    expect(parseTimestamp('02:03.456')).toBe(123_456)
  })

  it('reads short human forms', () => {
    expect(parseTimestamp('1:05')).toBe(65_000)
    expect(parseTimestamp('62.5')).toBe(62_500)
    expect(parseTimestamp('90')).toBe(90_000)
    expect(parseTimestamp(' 0:00.1 ')).toBe(100)
  })

  it('rejects out-of-range and malformed values', () => {
    expect(parseTimestamp('1:75')).toBeNull()
    expect(parseTimestamp('1:61:00')).toBeNull()
    expect(parseTimestamp('abc')).toBeNull()
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('-5')).toBeNull()
  })
})

describe('formatTimestamp', () => {
  it('omits hours under an hour', () => {
    expect(formatTimestamp(62_500)).toBe('1:02.500')
    expect(formatTimestamp(0)).toBe('0:00.000')
  })

  it('adds hours past an hour', () => {
    expect(formatTimestamp(3_723_456)).toBe('1:02:03.456')
  })

  it('round-trips through parseTimestamp', () => {
    for (const ms of [0, 999, 61_001, 3_599_999, 7_200_000]) expect(parseTimestamp(formatTimestamp(ms))).toBe(ms)
  })
})

describe('parseSubtitles', () => {
  it('parses SRT with multi-line cues and CRLF line endings', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:02,500\r\nHello\r\nthere\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\n<i>World</i>\r\n'
    const result = parseSubtitles(srt)
    expect(result.format).toBe('srt')
    expect(result.segments).toEqual([
      { startMs: 1000, endMs: 2500, text: 'Hello\nthere' },
      { startMs: 3000, endMs: 4000, text: 'World' }
    ])
    expect(result.warnings).toEqual([])
  })

  it('parses WebVTT: skips header/NOTE/STYLE, reads cue ids, settings and voice tags', () => {
    const vtt = [
      'WEBVTT - lesson 1',
      '',
      'NOTE translator notes here',
      '',
      'STYLE',
      '::cue { color: yellow }',
      '',
      'intro',
      '00:01.000 --> 00:02.000 align:start position:10%',
      '<v Ana>Konnichiwa &amp; welcome',
      '',
      '00:00:03.000 --> 00:00:04.000',
      '<c.yellow>Coffee</c>, <00:03.500>please'
    ].join('\n')
    const result = parseSubtitles(vtt)
    expect(result.format).toBe('vtt')
    expect(result.segments).toEqual([
      { startMs: 1000, endMs: 2000, text: 'Konnichiwa & welcome', speaker: 'Ana' },
      { startMs: 3000, endMs: 4000, text: 'Coffee, please' }
    ])
  })

  it('strips a BOM', () => {
    expect(parseSubtitles('﻿WEBVTT\n\n00:01.000 --> 00:02.000\nHi').segments).toHaveLength(1)
  })

  it('skips broken cues with a warning instead of failing the import', () => {
    const srt =
      '1\n00:00:05,000 --> 00:00:04,000\nBackwards\n\n2\n00:00:06,000 --> nonsense\nBad\n\n3\n00:00:07,000 --> 00:00:08,000\n\n\n4\n00:00:09,000 --> 00:00:10,000\nGood'
    const result = parseSubtitles(srt)
    expect(result.segments).toEqual([{ startMs: 9000, endMs: 10_000, text: 'Good' }])
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings[0]).toMatch(/Cue 1 skipped: it ends before it starts/)
    expect(result.warnings[1]).toMatch(/Cue 2 skipped: unreadable timing/)
    expect(result.warnings[2]).toMatch(/Cue 3 skipped: no text/)
  })

  it('sorts cues by start time', () => {
    const srt = '1\n00:00:05,000 --> 00:00:06,000\nB\n\n2\n00:00:01,000 --> 00:00:02,000\nA'
    expect(parseSubtitles(srt).segments.map((s) => s.text)).toEqual(['A', 'B'])
  })

  it('treats text without timings as one placeholder-timed segment per line', () => {
    const result = parseSubtitles('First line\n\n  Second line  \n')
    expect(result.format).toBe('text')
    expect(result.segments).toEqual([
      { startMs: 0, endMs: 3000, text: 'First line' },
      { startMs: 3000, endMs: 6000, text: 'Second line' }
    ])
    expect(result.warnings[0]).toMatch(/placeholder/)
  })

  it('returns nothing (and no warning) for empty input', () => {
    expect(parseSubtitles('   \n\n')).toEqual({ format: 'text', segments: [], warnings: [] })
  })
})

describe('segmentError', () => {
  it('accepts a valid segment', () => {
    expect(segmentError({ startMs: 0, endMs: 1000, text: 'Hi' })).toBeNull()
  })

  it('explains what is wrong', () => {
    expect(segmentError({ startMs: null, endMs: 1000, text: 'Hi' })).toMatch(/Start/)
    expect(segmentError({ startMs: 1000, endMs: 1000, text: 'Hi' })).toMatch(/after start/)
    expect(segmentError({ startMs: 0, endMs: 1000, text: '   ' })).toMatch(/empty/)
  })
})

describe('splitHighlight', () => {
  it('marks every case-insensitive match', () => {
    expect(splitHighlight('Coffee, coffee!', 'COFFEE')).toEqual([
      { text: 'Coffee', match: true },
      { text: ', ', match: false },
      { text: 'coffee', match: true },
      { text: '!', match: false }
    ])
  })

  it('returns the whole text unmarked for an empty term or no match', () => {
    expect(splitHighlight('abc', '  ')).toEqual([{ text: 'abc', match: false }])
    expect(splitHighlight('abc', 'x')).toEqual([{ text: 'abc', match: false }])
  })

  it('never produces HTML — markup in the text stays literal', () => {
    expect(
      splitHighlight('<b>x</b>', 'x')
        .map((p) => p.text)
        .join('')
    ).toBe('<b>x</b>')
  })
})
