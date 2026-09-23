import { describe, expect, it } from 'vitest'
import { bucketSeries, describeDelta, describeRateDelta, formatCount, niceBytesTop, niceSecondsTop, rangeDates } from './analytics'

describe('describeDelta', () => {
  it('reports whole-percent changes with a direction', () => {
    expect(describeDelta(112, 100)).toEqual({ text: '+12%', direction: 'up' })
    expect(describeDelta(97, 100)).toEqual({ text: '−3%', direction: 'down' })
    expect(describeDelta(100.2, 100)).toEqual({ text: 'No change', direction: 'flat' })
  })

  it('switches to a multiple for very large growth', () => {
    expect(describeDelta(5990, 27)).toEqual({ text: '222×', direction: 'up' })
    expect(describeDelta(1000, 100)).toEqual({ text: '+900%', direction: 'up' })
  })

  it('handles a zero baseline', () => {
    expect(describeDelta(5, 0)).toEqual({ text: 'New', direction: 'up' })
    expect(describeDelta(0, 0)).toEqual({ text: 'No change', direction: 'flat' })
  })

  it('reports rate changes in points', () => {
    expect(describeRateDelta(0.31, 0.27)).toEqual({ text: '+4 pts', direction: 'up' })
    expect(describeRateDelta(0.2, 0.2)).toEqual({ text: 'No change', direction: 'flat' })
  })
})

describe('rangeDates', () => {
  const today = new Date(2026, 8, 23)
  it('computes inclusive presets', () => {
    expect(rangeDates('7d', today)).toEqual({ from: '2026-09-17', to: '2026-09-23' })
    expect(rangeDates('30d', today)).toEqual({ from: '2026-08-25', to: '2026-09-23' })
    expect(rangeDates('month', today)).toEqual({ from: '2026-09-01', to: '2026-09-23' })
    expect(rangeDates('prev-month', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' })
  })
})

describe('bucketSeries', () => {
  const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, value: i + 1 }))

  it('keeps daily points when they fit', () => {
    expect(bucketSeries(days, 'sum', 62)).toHaveLength(10)
  })

  it('groups into weeks, summing or keeping the last value', () => {
    expect(bucketSeries(days, 'sum', 5)).toEqual([
      { start: '2026-01-01', end: '2026-01-07', value: 28 },
      { start: '2026-01-08', end: '2026-01-10', value: 27 }
    ])
    expect(bucketSeries(days, 'last', 5).map((b) => b.value)).toEqual([7, 10])
  })
})

describe('formatCount', () => {
  it('abbreviates', () => {
    expect(formatCount(950)).toBe('950')
    expect(formatCount(12_345)).toBe('12.3K')
    expect(formatCount(2_000_000)).toBe('2M')
  })
})

describe('axis tops', () => {
  it('rounds bytes in their display unit', () => {
    expect(niceBytesTop(17.6 * 1024 ** 3)).toBe(20 * 1024 ** 3)
    expect(niceBytesTop(1.3 * 1024 ** 3)).toBe(2 * 1024 ** 3)
    expect(niceBytesTop(700 * 1024 ** 2)).toBe(1000 * 1024 ** 2)
  })

  it('rounds seconds to minutes, hours or days', () => {
    expect(niceSecondsTop(1500)).toBe(25 * 60)
    expect(niceSecondsTop(2000)).toBe(50 * 60)
    expect(niceSecondsTop(30 * 3600)).toBe(50 * 3600)
    expect(niceSecondsTop(5.7 * 86_400)).toBe(10 * 86_400)
  })
})
