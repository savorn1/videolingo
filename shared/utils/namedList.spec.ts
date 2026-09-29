import { describe, expect, it } from 'vitest'
import { addEntry, removeEntry, renameEntry, uniqueName } from './namedList'

describe('uniqueName', () => {
  it('keeps a name that is not taken, else numbers it', () => {
    expect(uniqueName('Intro', [])).toBe('Intro')
    expect(uniqueName('Intro', ['Intro'])).toBe('Intro (2)')
    expect(uniqueName('Intro', ['Intro', 'Intro (2)'])).toBe('Intro (3)')
  })
  it('falls back to "Untitled" for a blank name', () => {
    expect(uniqueName('   ', [])).toBe('Untitled')
  })
})

describe('addEntry / removeEntry / renameEntry', () => {
  it('adds newest first and de-duplicates the name', () => {
    let list = addEntry([], 'Title', { a: 1 })
    list = addEntry(list, 'Title', { a: 2 })
    expect(list.map((e) => e.name)).toEqual(['Title (2)', 'Title'])
    expect(list[0]!.data).toEqual({ a: 2 })
  })

  it('overwrites in place when replaceId matches an existing entry', () => {
    let list = addEntry([], 'A', { v: 1 })
    const id = list[0]!.id
    list = addEntry(list, 'A renamed', { v: 2 }, id)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, name: 'A renamed', data: { v: 2 } })
  })

  it('removes and renames by id', () => {
    let list = addEntry(addEntry([], 'A', 1), 'B', 2)
    const bId = list.find((e) => e.name === 'B')!.id
    list = renameEntry(list, bId, 'B2')
    expect(list.find((e) => e.id === bId)!.name).toBe('B2')
    list = removeEntry(list, bId)
    expect(list.map((e) => e.name)).toEqual(['A'])
  })

  it('caps the list, dropping the oldest', () => {
    let list: ReturnType<typeof addEntry<number>> = []
    for (let i = 0; i < 5; i++) list = addEntry(list, `t${i}`, i, null, 3)
    expect(list).toHaveLength(3)
    expect(list.map((e) => e.data)).toEqual([4, 3, 2])
  })
})
