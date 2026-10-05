import { describe, expect, it } from 'vitest'
import { LINE_PAD_MS, PAUSE_KEEP_MS, fitRangeToLines, pauseCuts, pickTranscript, sentenceSplitRows, spokenTitle } from './transcriptCuts'
import { MAX_CUTS, validateCutOut } from './cutOut'
import { MIN_TRIM_MS, validateSegments } from './videoEdit'

const lines = [
  { startMs: 1000, endMs: 3000 },
  { startMs: 4000, endMs: 6000 },
  { startMs: 7000, endMs: 9500 }
]

describe('pickTranscript', () => {
  const ts = [
    { id: 1, language: 'en' },
    { id: 2, language: 'km' }
  ]
  it("prefers the video's own language, then the first", () => {
    expect(pickTranscript(ts, 'km')?.id).toBe(2)
    expect(pickTranscript(ts, 'fr')?.id).toBe(1)
    expect(pickTranscript(ts, null)?.id).toBe(1)
    expect(pickTranscript([], 'km')).toBeNull()
  })
})

describe('sentenceSplitRows', () => {
  it('cuts midway through each pause, covering the whole video', () => {
    expect(sentenceSplitRows(lines, 10_000)).toEqual([
      { startMsSeconds: 0, endMsSeconds: 3.5 },
      { startMsSeconds: 3.5, endMsSeconds: 6.5 },
      { startMsSeconds: 6.5, endMsSeconds: null }
    ])
  })
  it('groups lines evenly when there are more than allowed', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ startMs: i * 2000, endMs: i * 2000 + 1500 }))
    const rows = sentenceSplitRows(many, 100_000)
    expect(rows).toHaveLength(20)
    expect(
      validateSegments(
        rows.map((r) => ({ startMs: r.startMsSeconds * 1000, endMs: r.endMsSeconds == null ? null : r.endMsSeconds * 1000 })),
        100_000
      )
    ).toBeNull()
    expect(sentenceSplitRows(many, 100_000, 4)).toHaveLength(4)
  })
  it('skips a cut that would leave a segment too short', () => {
    const tight = [
      { startMs: 0, endMs: 200 },
      { startMs: 300, endMs: 5000 },
      { startMs: 5200, endMs: 9000 }
    ]
    const rows = sentenceSplitRows(tight, 9000)
    expect(rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 5.1 },
      { startMsSeconds: 5.1, endMsSeconds: null }
    ])
    for (const r of rows) expect(((r.endMsSeconds ?? 9) - r.startMsSeconds) * 1000).toBeGreaterThanOrEqual(MIN_TRIM_MS)
  })
  it('gives nothing to split with fewer than two usable lines', () => {
    expect(sentenceSplitRows([lines[0]!], 10_000)).toEqual([])
    expect(sentenceSplitRows([{ startMs: 5, endMs: 1 }, ...lines.slice(0, 1)], 10_000)).toEqual([])
    expect(sentenceSplitRows(lines, 0)).toEqual([])
  })
  it('handles overlapping or out-of-order lines', () => {
    const rows = sentenceSplitRows([lines[1]!, { startMs: 1000, endMs: 4500 }], 10_000)
    expect(rows).toEqual([
      { startMsSeconds: 0, endMsSeconds: 4.25 },
      { startMsSeconds: 4.25, endMsSeconds: null }
    ])
  })
})

describe('fitRangeToLines', () => {
  it('moves edges that cut through a line out to the line, with some room', () => {
    expect(fitRangeToLines([2000, 5000], lines, 10_000)).toEqual([1000 - LINE_PAD_MS, 6000 + LINE_PAD_MS])
  })
  it('leaves edges in a pause alone', () => {
    expect(fitRangeToLines([3500, 6500], lines, 10_000)).toEqual([3500, 6500])
  })
  it('stays inside the video', () => {
    expect(
      fitRangeToLines(
        [50, 9400],
        [
          { startMs: 0, endMs: 500 },
          { startMs: 9000, endMs: 9950 }
        ],
        10_000
      )
    ).toEqual([0, 10_000])
  })
  it('keeps the room out of a neighbouring line, so fitting again changes nothing', () => {
    const close = [
      { startMs: 1000, endMs: 2000 },
      { startMs: 2050, endMs: 3000 },
      { startMs: 3080, endMs: 4000 }
    ]
    const fitted = fitRangeToLines([2500, 2600], close, 10_000)
    expect(fitted).toEqual([2000, 3080])
    expect(fitRangeToLines(fitted, close, 10_000)).toEqual(fitted)
  })
})

describe('pauseCuts', () => {
  it('takes out long pauses, keeping room next to speech', () => {
    // speech 1–3 s and 4–6 s and 7–9.5 s in a 12 s video
    expect(pauseCuts(lines, 12_000, 1000)).toEqual([
      { startMs: 0, endMs: 1000 - PAUSE_KEEP_MS },
      { startMs: 3000 + PAUSE_KEEP_MS, endMs: 4000 - PAUSE_KEEP_MS },
      { startMs: 6000 + PAUSE_KEEP_MS, endMs: 7000 - PAUSE_KEEP_MS },
      { startMs: 9500 + PAUSE_KEEP_MS, endMs: 12_000 }
    ])
  })
  it('leaves pauses shorter than asked', () => {
    expect(pauseCuts(lines, 12_000, 1500)).toEqual([{ startMs: 9700, endMs: 12_000 }])
  })
  it('never cuts speech, even when lines overlap', () => {
    const cuts = pauseCuts(
      [
        { startMs: 1000, endMs: 4000 },
        { startMs: 3000, endMs: 5000 },
        { startMs: 8000, endMs: 9000 }
      ],
      10_000,
      700
    )
    for (const c of cuts) {
      expect(c.endMs <= 1000 || c.startMs >= 5000).toBe(true)
      expect(c.endMs <= 8000 || c.startMs >= 9000).toBe(true)
    }
    expect(validateCutOut(cuts, 10_000)).toBeNull()
  })
  it('keeps the longest pauses when there are too many, and stays valid', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ startMs: i * 3000, endMs: i * 3000 + 1000 + (i % 3) * 300 }))
    const cuts = pauseCuts(many, 121_000, 700)
    expect(cuts.length).toBeLessThanOrEqual(MAX_CUTS)
    expect(validateCutOut(cuts, 121_000)).toBeNull()
  })
  it('skips a cut that would leave a piece too short', () => {
    const tiny = [
      { startMs: 2000, endMs: 2100 },
      { startMs: 5000, endMs: 6000 }
    ]
    const cuts = pauseCuts(tiny, 6000, 700)
    expect(validateCutOut(cuts, 6000)).toBeNull()
  })
  it('gives nothing without lines or pauses', () => {
    expect(pauseCuts([], 10_000, 700)).toEqual([])
    expect(pauseCuts([{ startMs: 0, endMs: 10_000 }], 10_000, 700)).toEqual([])
  })
})

describe('spokenTitle', () => {
  const said = [
    { startMs: 1000, endMs: 3000, text: 'How are you' },
    { startMs: 3000, endMs: 4000, text: 'today?' },
    { startMs: 4500, endMs: 9000, text: 'Fine, thanks.' }
  ]
  it('names a clip after what is said in it', () => {
    expect(spokenTitle('Lesson 3', said, 500, 4200)).toBe('Lesson 3 — “How are you today?”')
  })
  it('cuts long words short and stays within 200 characters', () => {
    const long = [{ startMs: 0, endMs: 1000, text: 'word '.repeat(40) }]
    const title = spokenTitle('T'.repeat(300), long, 0, 1000)!
    expect(title.length).toBeLessThanOrEqual(200)
    expect(title).toMatch(/…”$/)
  })
  it('gives nothing when no line falls inside', () => {
    expect(spokenTitle('Lesson 3', said, 9000, 12_000)).toBeNull()
    expect(spokenTitle('Lesson 3', [], 0, 1000)).toBeNull()
  })
})
