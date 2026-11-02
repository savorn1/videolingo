import { afterEach, describe, expect, it, vi } from 'vitest'
import { scrollMotion } from './scrollMotion'

// jsdom has no matchMedia, so each test puts one in.
const prefers = (reduce: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }))

describe('scrollMotion', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('scrolls smoothly unless Reduce Motion is on', () => {
    prefers(false)
    expect(scrollMotion()).toBe('smooth')
    prefers(true)
    expect(scrollMotion()).toBe('auto')
  })
  it('jumps when it cannot ask', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(scrollMotion()).toBe('auto')
  })
})
