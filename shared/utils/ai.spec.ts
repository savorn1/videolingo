import { describe, expect, it } from 'vitest'
import { aiFeatureLabel, formatPercent, formatTokens, formatUsd, niceCeil, paragraphs } from './ai'

describe('formatUsd', () => {
  it('keeps fractions of a cent visible', () => {
    expect(formatUsd(0.002509)).toBe('$0.0025')
    expect(formatUsd(0.026635)).toBe('$0.027')
    expect(formatUsd(12.5)).toBe('$12.50')
  })

  it('handles zero, tiny and missing values', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(0.00001)).toBe('<$0.0001')
    expect(formatUsd(null)).toBe('—')
  })
})

describe('formatTokens', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(12_345)).toBe('12.3K')
    expect(formatTokens(2000)).toBe('2K')
    expect(formatTokens(4_100_000)).toBe('4.1M')
  })
})

describe('misc', () => {
  it('formats percentages and feature labels', () => {
    expect(formatPercent(0.4095)).toBe('41%')
    expect(aiFeatureLabel('KEY_POINTS')).toBe('Key points')
    expect(aiFeatureLabel('CHAT')).toBe('Chat')
  })

  it('splits paragraphs on blank lines', () => {
    expect(paragraphs('One.\n\nTwo\nstill two.\n \nThree')).toEqual(['One.', 'Two\nstill two.', 'Three'])
    expect(paragraphs(null)).toEqual([])
  })
})

describe('niceCeil', () => {
  it('rounds up to a 1/2/2.5/5 step', () => {
    expect(niceCeil(0.0266)).toBe(0.05)
    expect(niceCeil(0.02)).toBe(0.02)
    expect(niceCeil(3.1)).toBe(5)
    expect(niceCeil(7)).toBe(10)
    expect(niceCeil(220)).toBe(250)
  })

  it('falls back to 1 for empty data', () => {
    expect(niceCeil(0)).toBe(1)
  })
})
