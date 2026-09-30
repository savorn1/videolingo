import { describe, expect, it } from 'vitest'
import { dropIndex, moveItem } from './reorder'

describe('moveItem', () => {
  const abcd = ['a', 'b', 'c', 'd']
  it('moves an item forward and back', () => {
    expect(moveItem(abcd, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(abcd, 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('moves to either end', () => {
    expect(moveItem(abcd, 1, 0)).toEqual(['b', 'a', 'c', 'd'])
    expect(moveItem(abcd, 1, 3)).toEqual(['a', 'c', 'd', 'b'])
  })
  it('gives the list back when nothing moves or an index is out of range', () => {
    expect(moveItem(abcd, 2, 2)).toBe(abcd)
    expect(moveItem(abcd, -1, 2)).toBe(abcd)
    expect(moveItem(abcd, 1, 4)).toBe(abcd)
    expect(moveItem([], 0, 0)).toEqual([])
  })
  it('does not change its input', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 2)
    expect(list).toEqual(['a', 'b', 'c'])
  })
})

describe('dropIndex', () => {
  it('lands before or after the row it is dropped on', () => {
    // Dragging row 3 up onto row 1: above it takes index 1, below it takes index 2.
    expect(dropIndex(3, 1, 'before')).toBe(1)
    expect(dropIndex(3, 1, 'after')).toBe(2)
  })
  it('accounts for the dragged row leaving its old place', () => {
    // Dragging row 0 down onto row 2: above it ends at 1, below it ends at 2.
    expect(dropIndex(0, 2, 'before')).toBe(1)
    expect(dropIndex(0, 2, 'after')).toBe(2)
  })
  it('does nothing when dropped next to itself', () => {
    expect(dropIndex(2, 2, 'before')).toBe(2)
    expect(dropIndex(2, 2, 'after')).toBe(2)
    expect(dropIndex(2, 1, 'after')).toBe(2)
    expect(dropIndex(2, 3, 'before')).toBe(2)
  })
})
