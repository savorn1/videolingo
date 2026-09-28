import { describe, expect, it } from 'vitest'
import { estimateFps, formatTimecode, loopedTime, snapFps, stepFrameTime } from './transport'

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
