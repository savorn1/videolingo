import { describe, expect, it } from 'vitest'
import { formatColumnText } from './columnFormat'
import type { ColumnDef } from '#shared/types'

interface Row extends Record<string, unknown> {
  amount: number | null
  rate: number | null
  createdAt: string | null
  status: string | null
  active: boolean
  minAmount: number
  maxAmount: number | null
}

const row: Row = {
  amount: 1234.5,
  rate: 5.25,
  createdAt: '2026-03-05T10:30:00Z',
  status: 'PAST_DUE',
  active: true,
  minAmount: 100,
  maxAmount: 500
}

describe('formatColumnText', () => {
  it('formats currency as USD', () => {
    const column: ColumnDef<Row> = { key: 'amount', type: 'currency' }
    expect(formatColumnText(column, row)).toBe('$1,234.50')
  })

  it('formats percent with a trailing % sign', () => {
    const column: ColumnDef<Row> = { key: 'rate', type: 'percent' }
    expect(formatColumnText(column, row)).toBe('5.25%')
  })

  it('renders an em dash for an empty percent value', () => {
    const column: ColumnDef<Row> = { key: 'rate', type: 'percent' }
    expect(formatColumnText(column, { ...row, rate: null })).toBe('—')
  })

  it('formats an enum value by humanizing it', () => {
    const column: ColumnDef<Row> = { key: 'status', type: 'enum' }
    expect(formatColumnText(column, row)).toBe('Past due')
  })

  it('falls back to text formatting and shows an em dash for empty values', () => {
    const column: ColumnDef<Row> = { key: 'status' }
    expect(formatColumnText(column, { ...row, status: null })).toBe('—')
  })

  it('applies a value() derivation, prefix, and suffix', () => {
    const column: ColumnDef<Row> = {
      key: 'amount',
      value: (r) => r.amount,
      prefix: () => '~',
      suffix: ' USD'
    }
    expect(formatColumnText(column, row)).toBe('~1234.5 USD')
  })

  it('renders a "from – to" range when `to` is set', () => {
    const column: ColumnDef<Row> = { key: 'minAmount', to: 'maxAmount', type: 'currency' }
    expect(formatColumnText(column, row)).toBe('$100.00 – $500.00')
  })

  it('uses toEmpty (default em dash) when the `to` value is empty', () => {
    const column: ColumnDef<Row> = { key: 'minAmount', to: 'maxAmount', type: 'currency' }
    expect(formatColumnText(column, { ...row, maxAmount: null })).toBe('$100.00 – —')
  })
})
