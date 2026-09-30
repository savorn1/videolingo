import { describe, expect, it } from 'vitest'
import { DEFAULT_LEARN_SORT, LEARN_SORTS, normalizeSort, sortParams } from './learnSort'

// The columns the server lets the video list be sorted by (VideoServiceImpl.SORTABLE).
const SERVER_SORTABLE = ['id', 'title', 'language', 'durationSeconds', 'fileSize', 'enabled', 'createdAt', 'updatedAt', 'deletedAt']

describe('LEARN_SORTS', () => {
  it('only asks for columns the server allows', () => {
    for (const s of LEARN_SORTS) expect(SERVER_SORTABLE, s.value).toContain(s.sortBy)
  })
  it('has unique values, with the default first', () => {
    expect(new Set(LEARN_SORTS.map((s) => s.value)).size).toBe(LEARN_SORTS.length)
    expect(LEARN_SORTS[0].value).toBe(DEFAULT_LEARN_SORT)
  })
})

describe('normalizeSort', () => {
  it('keeps a known sort', () => {
    expect(normalizeSort('title')).toBe('title')
    expect(normalizeSort('longest')).toBe('longest')
  })
  it('falls back for anything else', () => {
    expect(normalizeSort(undefined)).toBe('newest')
    expect(normalizeSort('random')).toBe('newest')
    expect(normalizeSort(3)).toBe('newest')
  })
})

describe('sortParams', () => {
  it('gives the column and direction', () => {
    expect(sortParams('title')).toEqual({ sortBy: 'title', sortOrder: 'asc' })
    expect(sortParams('longest')).toEqual({ sortBy: 'durationSeconds', sortOrder: 'desc' })
    expect(sortParams('oldest')).toEqual({ sortBy: 'createdAt', sortOrder: 'asc' })
  })
  it('uses newest-first for anything unknown', () => {
    expect(sortParams(undefined)).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' })
    expect(sortParams('x')).toEqual({ sortBy: 'createdAt', sortOrder: 'desc' })
  })
})
