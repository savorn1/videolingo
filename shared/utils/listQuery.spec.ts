import { describe, expect, it } from 'vitest'
import { buildListQuery, coerceQueryValue } from './listQuery'

describe('coerceQueryValue', () => {
  it('restores integer ids as numbers', () => {
    // The case that matters: a filter sent as the string "12" wouldn't match an
    // id of 12 on the API and the list would come back empty.
    expect(coerceQueryValue('12')).toBe(12)
    expect(coerceQueryValue('-3')).toBe(-3)
  })

  it('restores booleans', () => {
    expect(coerceQueryValue('true')).toBe(true)
    expect(coerceQueryValue('false')).toBe(false)
  })

  it('leaves status enums as strings', () => {
    expect(coerceQueryValue('CONFIRMED')).toBe('CONFIRMED')
    expect(coerceQueryValue('PARTIALLY_DELIVERED')).toBe('PARTIALLY_DELIVERED')
  })

  it('does not mangle values that merely look numeric', () => {
    // Leading zeros and exponent notation are real document-number shapes;
    // converting them would silently rewrite what the user filtered on.
    expect(coerceQueryValue('007')).toBe('007')
    expect(coerceQueryValue('1e5')).toBe('1e5')
    expect(coerceQueryValue('12.5')).toBe('12.5')
  })

  it('leaves integers too large to represent exactly as strings', () => {
    expect(coerceQueryValue('900719925474099123')).toBe('900719925474099123')
  })
})

describe('buildListQuery', () => {
  it('omits unset filters so the URL stays clean', () => {
    expect(buildListQuery({ filter: { companyId: undefined, status: undefined } })).toEqual({})
  })

  it('serialises set filters', () => {
    expect(buildListQuery({ filter: { companyId: 12, status: 'CONFIRMED', active: false } })).toEqual({
      companyId: '12',
      status: 'CONFIRMED',
      active: 'false'
    })
  })

  it('treats an empty string filter as unset', () => {
    expect(buildListQuery({ filter: { name: '' } })).toEqual({})
  })

  it('includes a search term but omits an empty one', () => {
    expect(buildListQuery({ search: 'SO-1' })).toEqual({ q: 'SO-1' })
    expect(buildListQuery({ search: '' })).toEqual({})
  })

  it('omits page 1 and includes any other page', () => {
    expect(buildListQuery({ page: 1 })).toEqual({})
    expect(buildListQuery({ page: 3 })).toEqual({ page: '3' })
  })

  it('round-trips a realistic list state', () => {
    const query = buildListQuery({ filter: { companyId: 12, status: 'CONFIRMED' }, search: 'SO-1', page: 2 })
    expect(query).toEqual({ companyId: '12', status: 'CONFIRMED', q: 'SO-1', page: '2' })
    expect(coerceQueryValue(query.companyId!)).toBe(12)
    expect(coerceQueryValue(query.status!)).toBe('CONFIRMED')
  })
})
