import { describe, expect, it } from 'vitest'
import { cuesToVtt, currentLineStart, lineAt, lineEndAction, nextLineStart, previousLineStart } from './sentences'

const cues = [
  { startMs: 0, endMs: 3000 },
  { startMs: 4000, endMs: 7000 },
  { startMs: 7000, endMs: 10000 }
]

describe('line navigation', () => {
  it('finds the current line, including gaps between lines', () => {
    expect(lineAt(cues, 1000)).toBe(0)
    expect(lineAt(cues, 3500)).toBe(0)
    expect(lineAt(cues, 7000)).toBe(2)
    expect(lineAt([{ startMs: 500, endMs: 900 }], 100)).toBe(-1)
  })
  it('restarts the line, or goes back one when just started', () => {
    expect(previousLineStart(cues, 6000)).toBe(4000)
    expect(previousLineStart(cues, 4500)).toBe(0)
    expect(previousLineStart(cues, 200)).toBe(0)
  })
  it('goes to the next line, and stops after the last', () => {
    expect(nextLineStart(cues, 1000)).toBe(4000)
    expect(nextLineStart(cues, 4000)).toBe(7000)
    expect(nextLineStart(cues, 8000)).toBeNull()
    expect(currentLineStart(cues, 3500)).toBe(0)
  })
  it('replays the line just heard when paused right at the next one', () => {
    expect(currentLineStart(cues, 7000)).toBe(4000)
    expect(currentLineStart(cues, 7200)).toBe(4000)
    expect(currentLineStart(cues, 8500)).toBe(7000)
    // After a real gap, the new line is the one to replay.
    expect(currentLineStart(cues, 4100)).toBe(4000)
  })
})

describe('lineEndAction', () => {
  it('loops back at the end of the line', () => {
    expect(lineEndAction(cues, 1, 7010, { loop: true, pauseAfter: false }, null)).toEqual({ type: 'loop', toMs: 4000 })
  })
  it('pauses once per line', () => {
    expect(lineEndAction(cues, 1, 7010, { loop: false, pauseAfter: true }, null)).toEqual({ type: 'pause', line: 1 })
    expect(lineEndAction(cues, 1, 7050, { loop: false, pauseAfter: true }, 1)).toEqual({ type: 'none' })
  })
  it('ignores mid-line times and big jumps past the end', () => {
    expect(lineEndAction(cues, 1, 5000, { loop: true, pauseAfter: false }, null)).toEqual({ type: 'none' })
    expect(lineEndAction(cues, 1, 9000, { loop: true, pauseAfter: false }, null)).toEqual({ type: 'none' })
  })
})

describe('cuesToVtt', () => {
  it('writes WebVTT with the second language underneath', () => {
    const vtt = cuesToVtt([{ startMs: 1500, endMs: 3000, text: 'Hello' }], [{ startMs: 1000, endMs: 3500, text: 'សួស្តី' }])
    expect(vtt).toBe('WEBVTT\n\n00:00:01.500 --> 00:00:03.000\nHello\nសួស្តី\n')
  })
})
