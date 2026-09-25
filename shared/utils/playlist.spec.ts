import { describe, expect, it } from 'vitest'
import { nextIndex, previousIndex, shuffledOrder } from './playlist'

describe('nextIndex', () => {
  const order = [0, 2, 3] // item 1 isn't playable
  it('moves along the order and stops at the end', () => {
    expect(nextIndex(order, 0, 'off', true)).toBe(2)
    expect(nextIndex(order, 3, 'off', true)).toBeNull()
  })
  it('wraps with repeat-all', () => {
    expect(nextIndex(order, 3, 'all', true)).toBe(0)
  })
  it('replays with repeat-one only when the video ended by itself', () => {
    expect(nextIndex(order, 2, 'one', true)).toBe(2)
    expect(nextIndex(order, 2, 'one', false)).toBe(3)
  })
  it('starts over from an item that is not in the order', () => {
    expect(nextIndex(order, 1, 'off', false)).toBe(0)
  })
})

describe('previousIndex', () => {
  it('goes back, wrapping only when repeating', () => {
    expect(previousIndex([0, 2, 3], 2, 'off')).toBe(0)
    expect(previousIndex([0, 2, 3], 0, 'off')).toBeNull()
    expect(previousIndex([0, 2, 3], 0, 'all')).toBe(3)
  })
})

describe('shuffledOrder', () => {
  it('keeps every playable item once, with the current one first', () => {
    const order = shuffledOrder([0, 1, 2, 3, 4], 3, () => 0.42)
    expect(order[0]).toBe(3)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4])
  })
  it('ignores a starting item that is not playable', () => {
    expect(shuffledOrder([0, 2], 1, () => 0).sort()).toEqual([0, 2])
  })
})
