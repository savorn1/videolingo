import { describe, expect, it } from 'vitest'
import { mergeById, sameIds } from './syncedList'

const e = (id: string, name = id) => ({ id, name })

describe('mergeById', () => {
  it('puts the preferred list first and adds what it lacks', () => {
    expect(mergeById([e('a'), e('b')], [e('c'), e('a', 'old')]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('lets the preferred copy win for the same id', () => {
    expect(mergeById([e('a', 'new')], [e('a', 'old')])).toEqual([e('a', 'new')])
  })
  it('caps the result', () => {
    expect(mergeById([e('a'), e('b')], [e('c'), e('d')], 3).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('copes with empty lists', () => {
    expect(mergeById([], [])).toEqual([])
    expect(mergeById([], [e('a')])).toEqual([e('a')])
  })
})

describe('sameIds', () => {
  it('compares ids in order', () => {
    expect(sameIds([e('a'), e('b')], [e('a', 'x'), e('b')])).toBe(true)
    expect(sameIds([e('a'), e('b')], [e('b'), e('a')])).toBe(false)
    expect(sameIds([e('a')], [])).toBe(false)
  })
})
