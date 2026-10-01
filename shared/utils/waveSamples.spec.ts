import { describe, expect, it } from 'vitest'
import { barHeight, canDrawFromAudio, COLUMNS, firstSeconds, frameColumns, loopTime, REAL_STYLES, WAVE_FPS } from './waveSamples'

describe('frameColumns', () => {
  const sr = 1500 // a frame is 100 samples at 15 fps

  it('gives one value per column', () => {
    expect(frameColumns(new Float32Array(1000), sr, 0, 20)).toHaveLength(20)
  })
  it('takes the largest sample in each column, keeping its sign', () => {
    const s = new Float32Array(1000)
    s[0] = 0.2
    s[2] = -0.7 // inside the first column (samples 0–9 of 10 columns)
    s[55] = 0.5 // sixth column
    const cols = frameColumns(s, sr, 0, 10)
    expect(cols[0]).toBeCloseTo(-0.7)
    expect(cols[5]).toBeCloseTo(0.5)
    expect(cols[1]).toBe(0)
  })
  it('moves along with the time', () => {
    const s = new Float32Array(1500)
    s[750] = 0.9 // at 0.5 s
    expect(frameColumns(s, sr, 0, 10).every((v) => v === 0)).toBe(true)
    expect(Math.max(...frameColumns(s, sr, 0.5, 10))).toBeCloseTo(0.9)
  })
  it('is silent past the end and for empty or bad input', () => {
    expect(frameColumns(new Float32Array(100), sr, 5, 8).every((v) => v === 0)).toBe(true)
    expect(frameColumns([], sr, 0, 8)).toEqual(new Array(8).fill(0))
    expect(frameColumns(new Float32Array(10), 0, 0, 4)).toEqual([0, 0, 0, 0])
    expect(frameColumns(new Float32Array(10), sr, 0, 0)).toEqual([])
  })
  it('keeps values within -1 to 1', () => {
    expect(frameColumns([5, -5], sr, 0, 2).every((v) => v >= -1 && v <= 1)).toBe(true)
  })
  it('draws at the same frame rate as the server', () => {
    expect(WAVE_FPS).toBe(15)
  })
})

describe('barHeight', () => {
  it('lifts quiet sounds with a square root, within bounds', () => {
    expect(barHeight(0.25)).toBeCloseTo(11.5)
    expect(barHeight(0)).toBe(1.2)
    expect(barHeight(-1)).toBe(23)
    expect(barHeight(4)).toBe(23)
  })
})

describe('loopTime', () => {
  it('wraps around the length', () => {
    expect(loopTime(9, 8)).toBe(1)
    expect(loopTime(-1, 8)).toBe(7)
    expect(loopTime(3, 0)).toBe(0)
  })
})

describe('firstSeconds', () => {
  it('averages the channels and keeps only the first seconds', () => {
    const out = firstSeconds(
      [
        [1, 1, 1, 1],
        [0, 0, 0, 0]
      ],
      2,
      1
    )!
    expect(Array.from(out)).toEqual([0.5, 0.5])
  })
  it('returns null when there is nothing', () => {
    expect(firstSeconds([], 44100)).toBeNull()
    expect(firstSeconds([[]], 44100)).toBeNull()
    expect(firstSeconds([[1]], 0)).toBeNull()
  })
})

describe('styles that can be drawn from the sound', () => {
  it('know their column counts, and leave frequency styles alone', () => {
    for (const s of REAL_STYLES) expect(COLUMNS[s]).toBeGreaterThan(0)
    expect(canDrawFromAudio('PULSE')).toBe(true)
    expect(canDrawFromAudio('BARS')).toBe(false)
    expect(canDrawFromAudio('SPECTRUM')).toBe(false)
  })
})
