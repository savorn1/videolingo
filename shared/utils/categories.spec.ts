import { afterEach, describe, expect, it } from 'vitest'
import { categoryById, categoryCatalog, categoryOptions, setCategoryCatalog } from './categories'

afterEach(() => setCategoryCatalog([]))

const base = { slug: 'x', color: null }

describe('category catalog', () => {
  it('orders by sortOrder, then name', () => {
    setCategoryCatalog([
      { ...base, id: 1, name: 'Travel', sortOrder: 5, enabled: true },
      { ...base, id: 2, name: 'Food', sortOrder: 0, enabled: true },
      { ...base, id: 3, name: 'Business', sortOrder: 5, enabled: true }
    ])
    expect(categoryCatalog().map((c) => c.name)).toEqual(['Food', 'Business', 'Travel'])
    expect(categoryById(3)?.name).toBe('Business')
  })

  it('offers enabled categories, plus disabled ones the record already has', () => {
    setCategoryCatalog([
      { ...base, id: 1, name: 'Food', sortOrder: 0, enabled: true },
      { ...base, id: 2, name: 'Travel', sortOrder: 0, enabled: false }
    ])
    expect(categoryOptions().map((o) => o.value)).toEqual([1])
    expect(categoryOptions([2])).toEqual([
      { label: 'Food', value: 1 },
      { label: 'Travel (disabled)', value: 2 }
    ])
  })
})
