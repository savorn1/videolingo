import { describe, expect, it } from 'vitest'
import { activeCueIndex, charsPerSecond, checkSubtitleCues, type SubtitleRules } from './subtitleQuality'

const RULES: SubtitleRules = { maxCharsPerLine: 42, maxLines: 2, minDurationMs: 1000, maxDurationMs: 7000, maxCps: 17 }

describe('checkSubtitleCues (mirrors backend SubtitleQuality)', () => {
  it('flags each kind of problem, same cases as the Java test', () => {
    const cues = [
      { startMs: 0, endMs: 500, text: 'Too short' },
      { startMs: 400, endMs: 2000, text: 'Overlapped by the one before' },
      { startMs: 3000, endMs: 4000, text: 'This line is definitely far too long to fit on a subtitle line' },
      { startMs: 5000, endMs: 6000, text: 'a\nb\nc' },
      { startMs: 7000, endMs: 16000, text: 'Too long on screen' },
      { startMs: 17000, endMs: 17500, text: 'Way too many characters for half a second' }
    ]
    const types = new Set(checkSubtitleCues(cues, RULES).map((i) => i.type))
    expect(types).toEqual(new Set(['TOO_SHORT', 'OVERLAP', 'LINE_TOO_LONG', 'TOO_MANY_LINES', 'TOO_LONG', 'TOO_FAST']))
  })

  it('passes a clean track', () => {
    expect(
      checkSubtitleCues(
        [
          { startMs: 0, endMs: 2000, text: 'Hello.' },
          { startMs: 2000, endMs: 4000, text: 'How are you?' }
        ],
        RULES
      )
    ).toEqual([])
  })

  it('counts CJK characters and emoji as one each for line length', () => {
    const cjk = { ...RULES, maxCharsPerLine: 16 }
    expect(checkSubtitleCues([{ startMs: 0, endMs: 5000, text: '本日は季節限定のかぼちゃラテも' }], cjk)).toEqual([])
    expect(checkSubtitleCues([{ startMs: 0, endMs: 5000, text: '本日は季節限定のかぼちゃラテもあ' + '🎃' }], cjk)[0]?.type).toBe('LINE_TOO_LONG')
  })
})

describe('charsPerSecond', () => {
  it('ignores whitespace and line breaks', () => {
    expect(charsPerSecond('ab cd\nef', 0, 2000)).toBe(3)
  })

  it('is 0 for a zero-length cue instead of Infinity', () => {
    expect(charsPerSecond('abc', 1000, 1000)).toBe(0)
  })
})

describe('activeCueIndex', () => {
  const cues = [
    { startMs: 0, endMs: 1000 },
    { startMs: 1000, endMs: 2000 },
    { startMs: 3000, endMs: 4000 }
  ]
  it('finds the cue on screen, treating end as exclusive', () => {
    expect(activeCueIndex(cues, 500)).toBe(0)
    expect(activeCueIndex(cues, 1000)).toBe(1)
    expect(activeCueIndex(cues, 3999)).toBe(2)
  })

  it('returns -1 in gaps and after the end', () => {
    expect(activeCueIndex(cues, 2500)).toBe(-1)
    expect(activeCueIndex(cues, 4000)).toBe(-1)
  })
})
