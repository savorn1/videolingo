import { describe, expect, it } from 'vitest'
import { estimateFps, formatTimecode, loopedTime, parseTimecode, snapFps, stepFrameTime } from './transport'

describe('snapFps', () => {
  it('snaps near-standard measurements', () => {
    expect(snapFps(29.93)).toBe(29.97)
    expect(snapFps(24.2)).toBe(24)
    expect(snapFps(59.5)).toBe(59.94)
  })
  it('keeps unusual rates and guards nonsense', () => {
    expect(snapFps(15)).toBe(15)
    expect(snapFps(0)).toBe(30)
    expect(snapFps(Number.NaN)).toBe(30)
  })
})

describe('estimateFps', () => {
  it('needs enough samples', () => {
    expect(estimateFps([1 / 25, 1 / 25])).toBeNull()
  })
  it('uses the median, ignoring dropped frames and junk', () => {
    const d = [...Array(10).fill(1 / 25), 2 / 25, 0, 1]
    expect(estimateFps(d)).toBe(25)
  })
})

describe('stepFrameTime', () => {
  it('moves one frame and lands mid-frame', () => {
    expect(stepFrameTime(0, 25, 1)).toBeCloseTo(0.06)
    expect(stepFrameTime(0.06, 25, 1)).toBeCloseTo(0.1)
    expect(stepFrameTime(0.1, 25, -1)).toBeCloseTo(0.06)
    expect(stepFrameTime(0.06, 25, -1)).toBeCloseTo(0.02)
  })
  it('treats an exact frame boundary as that frame', () => {
    expect(stepFrameTime(0.04, 25, 1)).toBeCloseTo(0.1)
  })
  it('stops at the first and last frame', () => {
    expect(stepFrameTime(0.01, 25, -1)).toBeCloseTo(0.02)
    expect(stepFrameTime(1.99, 25, 1, 2)).toBeCloseTo(1.98)
  })
})

describe('loopedTime', () => {
  it('wraps at the end and pulls in from before the start', () => {
    expect(loopedTime(5, [2, 5])).toBe(2)
    expect(loopedTime(1, [2, 5])).toBe(2)
  })
  it('leaves playback inside the section alone', () => {
    expect(loopedTime(3, [2, 5])).toBeNull()
    expect(loopedTime(1.97, [2, 5])).toBeNull()
  })
  it('ignores an empty section', () => {
    expect(loopedTime(9, [2, 2])).toBeNull()
  })
})

describe('formatTimecode', () => {
  it('formats minutes and hours with hundredths', () => {
    expect(formatTimecode(0)).toBe('0:00.00')
    expect(formatTimecode(83_450)).toBe('1:23.45')
    expect(formatTimecode(3_723_450)).toBe('1:02:03.45')
  })
})

describe('parseTimecode', () => {
  it('reads plain seconds, with or without a fraction', () => {
    expect(parseTimecode('83')).toBe(83_000)
    expect(parseTimecode('83.5')).toBe(83_500)
    expect(parseTimecode('0')).toBe(0)
  })
  it('reads minutes:seconds and hours:minutes:seconds', () => {
    expect(parseTimecode('1:23')).toBe(83_000)
    expect(parseTimecode('1:23.45')).toBe(83_450)
    expect(parseTimecode('1:02:03.45')).toBe(3_723_450)
  })
  it('ignores surrounding spaces', () => {
    expect(parseTimecode('  1:23  ')).toBe(83_000)
  })
  it('accepts seconds past 59 and adds them up', () => {
    expect(parseTimecode('1:75')).toBe(135_000)
  })
  it('gives null for anything that is not a time', () => {
    for (const text of ['', ' ', 'abc', '1:', ':30', '-5', '1:2:3:4', '1..5', '.5', '1:23s', '1,5']) {
      expect(parseTimecode(text), text).toBeNull()
    }
  })
  it('reverses formatTimecode', () => {
    for (const ms of [0, 10, 990, 83_450, 3_723_450]) {
      expect(parseTimecode(formatTimecode(ms))).toBe(ms)
    }
  })
})
