import { describe, expect, it } from 'vitest'
import { fillerWordCuts, fillerWords, isSentenceCut, subtractCutRange, toggleSentenceCut, toggleWordCut } from './transcriptCuts'

// Three sentences with short pauses, then one after a long pause.
const S = [
  { startMs: 0, endMs: 2000 },
  { startMs: 2300, endMs: 4000 },
  { startMs: 4500, endMs: 6000 },
  { startMs: 9000, endMs: 10_000 }
]

describe('toggleSentenceCut', () => {
  it('cuts one sentence', () => {
    expect(toggleSentenceCut(S, 1, [], 10_000)).toEqual([{ startMs: 2300, endMs: 4000 }])
  })
  it('cuts the pause to a crossed-out neighbour too', () => {
    const one = toggleSentenceCut(S, 1, [], 10_000)
    expect(toggleSentenceCut(S, 2, one, 10_000)).toEqual([{ startMs: 2300, endMs: 6000 }])
    expect(toggleSentenceCut(S, 0, one, 10_000)).toEqual([{ startMs: 0, endMs: 4000 }])
  })
  it('leaves a long pause alone', () => {
    const one = toggleSentenceCut(S, 2, [], 10_000)
    expect(toggleSentenceCut(S, 3, one, 10_000)).toEqual([
      { startMs: 4500, endMs: 6000 },
      { startMs: 9000, endMs: 10_000 }
    ])
  })
  it('brings a sentence back, with its pauses, splitting the cut', () => {
    let cuts = toggleSentenceCut(S, 0, [], 10_000)
    cuts = toggleSentenceCut(S, 1, cuts, 10_000)
    cuts = toggleSentenceCut(S, 2, cuts, 10_000)
    expect(cuts).toEqual([{ startMs: 0, endMs: 6000 }])
    expect(toggleSentenceCut(S, 1, cuts, 10_000)).toEqual([
      { startMs: 0, endMs: 2000 },
      { startMs: 4500, endMs: 6000 }
    ])
  })
  it('knows a sentence inside a cut made by hand', () => {
    expect(isSentenceCut(S[1]!, [{ startMs: 2000, endMs: 4200 }])).toBe(true)
    expect(isSentenceCut(S[1]!, [{ startMs: 2500, endMs: 4200 }])).toBe(false)
  })
})

describe('subtractCutRange', () => {
  it('trims, splits or keeps cuts', () => {
    const cuts = [
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: 5000 }
    ]
    expect(subtractCutRange(cuts, { startMs: 3000, endMs: 4000 })).toEqual([
      { startMs: 0, endMs: 1000 },
      { startMs: 2000, endMs: 3000 },
      { startMs: 4000, endMs: 5000 }
    ])
    expect(subtractCutRange(cuts, { startMs: 500, endMs: 2500 })).toEqual([
      { startMs: 0, endMs: 500 },
      { startMs: 2500, endMs: 5000 }
    ])
  })
})

describe('by word', () => {
  const words = [
    { startMs: 0, endMs: 400, text: 'Hello,' },
    { startMs: 600, endMs: 800, text: 'Um,' },
    { startMs: 1000, endMs: 1500, text: 'welcome' },
    { startMs: 2600, endMs: 2800, text: 'uh' }
  ]
  it('cuts a word and brings it back', () => {
    const cut = toggleWordCut(words[2]!, [])
    expect(cut).toEqual([{ startMs: 1000, endMs: 1500 }])
    expect(toggleWordCut(words[2]!, cut)).toEqual([])
  })
  it('finds the filler words whatever their case or punctuation', () => {
    expect(fillerWords([{ words }, { words: null }]).map((w) => w.text)).toEqual(['Um,', 'uh'])
  })
  it('cuts the filler words that fit, leaving no piece under half a second', () => {
    // "uh" ends 0.2 s before an existing cut, so cutting it would leave a 0.2 s sliver: it stays in.
    const r = fillerWordCuts(fillerWords([{ words }]), [{ startMs: 3000, endMs: 4000 }], 10_000)
    expect(r.cuts).toEqual([{ startMs: 600, endMs: 800 }])
    expect(r.skipped).toBe(1)
  })
})
