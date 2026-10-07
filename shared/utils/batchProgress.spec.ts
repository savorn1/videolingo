import { describe, expect, it } from 'vitest'
import { batchCounts, batchSummary, MAX_BATCH_JOBS, parseJobIds } from './batchProgress'

describe('parseJobIds', () => {
  it('reads positive whole numbers once, in order', () => {
    expect(parseJobIds('7,8, 9,8')).toEqual([7, 8, 9])
    expect(parseJobIds(['7,8', '9'])).toEqual([7, 8, 9])
  })
  it('ignores anything that is not an id', () => {
    expect(parseJobIds('0,-1,2.5,x,,3')).toEqual([3])
    expect(parseJobIds(undefined)).toEqual([])
    expect(parseJobIds(42)).toEqual([])
  })
  it('follows at most the limit', () => {
    expect(parseJobIds(Array.from({ length: 150 }, (_, i) => i + 1).join(','))).toHaveLength(MAX_BATCH_JOBS)
  })
})

describe('batchCounts / batchSummary', () => {
  it('counts done, failed and going (not loaded yet counts as going)', () => {
    expect(batchCounts(['SUCCEEDED', 'FAILED', 'CANCELLED', 'RUNNING', 'QUEUED', null])).toEqual({ total: 6, done: 1, failed: 2, active: 3 })
  })
  it('sums it up in a line', () => {
    expect(batchSummary(batchCounts(['SUCCEEDED', 'RUNNING', 'FAILED']))).toBe('1 of 3 ready · 1 failed')
    expect(batchSummary(batchCounts(['SUCCEEDED', 'SUCCEEDED']))).toBe('All 2 ready')
    expect(batchSummary(batchCounts(['SUCCEEDED']))).toBe('Ready')
    expect(batchSummary(batchCounts(['FAILED', 'CANCELLED']))).toBe('All 2 failed')
    expect(batchSummary(batchCounts([]))).toBe('Nothing to follow')
  })
})
