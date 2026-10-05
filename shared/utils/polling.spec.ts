import { describe, expect, it } from 'vitest'
import { MAX_POLL_BACKOFF_MS, pollingDelay } from './polling'

describe('pollingDelay', () => {
  it('waits the base interval normally', () => {
    expect(pollingDelay(3000, false)).toBe(3000)
    expect(pollingDelay(3000, false, 0)).toBe(3000)
  })
  it('stops while the tab is hidden', () => {
    expect(pollingDelay(3000, true)).toBeNull()
    expect(pollingDelay(3000, true, 4)).toBeNull()
  })
  it('doubles after each failure in a row, up to the cap', () => {
    expect(pollingDelay(3000, false, 1)).toBe(6000)
    expect(pollingDelay(3000, false, 2)).toBe(12_000)
    expect(pollingDelay(3000, false, 50)).toBe(MAX_POLL_BACKOFF_MS)
  })
  it('never drops below the base interval, even when the base is above the cap', () => {
    expect(pollingDelay(120_000, false, 3)).toBe(120_000)
  })
})
