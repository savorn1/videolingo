import { describe, expect, it } from 'vitest'
import { formatInterval, nextIntervalDays } from './srs'

describe('nextIntervalDays (mirrors backend Srs)', () => {
  it('grows like the Java test: 1, 3, 8 days on Good', () => {
    expect(nextIntervalDays({ ease: 2.5, intervalDays: 0, repetitions: 0 }, 'GOOD')).toBe(1)
    expect(nextIntervalDays({ ease: 2.5, intervalDays: 1, repetitions: 1 }, 'GOOD')).toBe(3)
    expect(nextIntervalDays({ ease: 2.5, intervalDays: 3, repetitions: 2 }, 'GOOD')).toBe(8)
  })
  it('brings a forgotten card back within minutes', () => {
    expect(nextIntervalDays({ ease: 2.5, intervalDays: 20, repetitions: 5 }, 'AGAIN')).toBe(0)
    expect(formatInterval(0)).toBe('<10m')
  })
  it('formats longer intervals', () => {
    expect(formatInterval(45)).toBe('2mo')
    expect(formatInterval(365)).toBe('1y')
  })
})
