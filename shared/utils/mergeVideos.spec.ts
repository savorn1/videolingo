import { describe, expect, it } from 'vitest'
import {
  blockedReason,
  defaultMergeTitle,
  describeEstimate,
  estimateMergeSeconds,
  MAX_MERGE_SECONDS,
  MAX_MERGE_VIDEOS,
  mergeProblem,
  mergeShares,
  mergeStarts,
  mergeTotals,
  sanitizeMergeLook,
  type MergeItem
} from './mergeVideos'

const item = (id: number, durationSeconds: number | null = 60, blocked: string | null = null, title = `Video ${id}`): MergeItem => ({
  id,
  title,
  durationSeconds,
  thumbnailUrl: null,
  blocked
})

describe('mergeTotals', () => {
  it('adds the lengths that are known and counts the rest', () => {
    expect(mergeTotals([item(1, 60), item(2, null), item(3, 90), item(4, 0)])).toEqual({ seconds: 150, unknown: 2 })
    expect(mergeTotals([])).toEqual({ seconds: 0, unknown: 0 })
  })
})

describe('mergeProblem', () => {
  it('accepts two to ten joinable videos', () => {
    expect(mergeProblem([item(1), item(2)])).toBeNull()
    expect(mergeProblem(Array.from({ length: MAX_MERGE_VIDEOS }, (_, i) => item(i + 1)))).toBeNull()
  })
  it('needs at least two and at most ten', () => {
    expect(mergeProblem([])).toMatch(/at least 2/)
    expect(mergeProblem([item(1)])).toMatch(/at least 2/)
    expect(mergeProblem(Array.from({ length: MAX_MERGE_VIDEOS + 1 }, (_, i) => item(i + 1)))).toMatch(/At most 10/)
  })
  it('names a video that cannot be joined', () => {
    expect(mergeProblem([item(1), item(2, 60, 'is in the trash', 'Old one')])).toBe('“Old one” is in the trash')
  })
  it('refuses a total over the limit', () => {
    expect(mergeProblem([item(1, MAX_MERGE_SECONDS), item(2, 1)])).toMatch(/over 3 hours/)
    expect(mergeProblem([item(1, MAX_MERGE_SECONDS - 1), item(2, 1)])).toBeNull()
  })
  it('does not count a video with no recorded length against the limit', () => {
    expect(mergeProblem([item(1, null), item(2, null)])).toBeNull()
  })
})

describe('blockedReason', () => {
  it('lets stored, live videos through', () => {
    expect(blockedReason({ deleted: false, storageKey: 'videos/x.mp4', source: 'UPLOAD' })).toBeNull()
  })
  it('blocks the trash and links', () => {
    expect(blockedReason({ deleted: true, storageKey: 'videos/x.mp4', source: 'UPLOAD' })).toMatch(/trash/)
    expect(blockedReason({ deleted: false, storageKey: null, source: 'YOUTUBE' })).toMatch(/link/)
    expect(blockedReason({ deleted: false, storageKey: null })).toMatch(/link/)
    expect(blockedReason({ deleted: false, source: 'URL' })).toMatch(/link/)
  })
  it('does not block when nothing is known about where it lives', () => {
    expect(blockedReason({ deleted: false })).toBeNull()
  })
})

describe('defaultMergeTitle', () => {
  it('joins up to three titles', () => {
    expect(defaultMergeTitle(['A', 'B'])).toBe('A + B')
    expect(defaultMergeTitle(['A', 'B', 'C'])).toBe('A + B + C')
  })
  it('sums up longer lists', () => {
    expect(defaultMergeTitle(['A', 'B', 'C', 'D'])).toBe('A + 3 more')
  })
  it('ignores blanks and copes with nothing', () => {
    expect(defaultMergeTitle([' A ', '', 'B'])).toBe('A + B')
    expect(defaultMergeTitle([])).toBe('')
  })
  it('stays within 200 characters', () => {
    expect(defaultMergeTitle(['x'.repeat(150), 'y'.repeat(150)]).length).toBeLessThanOrEqual(200)
  })
})

describe('mergeStarts', () => {
  it('adds up the lengths before each video', () => {
    expect(mergeStarts([{ durationSeconds: 60 }, { durationSeconds: 90 }, { durationSeconds: 30 }])).toEqual([0, 60, 150])
  })
  it('cannot place anything after a video of unknown length', () => {
    expect(mergeStarts([{ durationSeconds: 60 }, { durationSeconds: null }, { durationSeconds: 30 }])).toEqual([0, 60, null])
    expect(mergeStarts([{ durationSeconds: 0 }, { durationSeconds: 30 }])).toEqual([0, null])
  })
  it('handles none', () => {
    expect(mergeStarts([])).toEqual([])
  })
})

describe('mergeShares', () => {
  it('shares the length in proportion, adding up to 100', () => {
    const shares = mergeShares([{ durationSeconds: 60 }, { durationSeconds: 180 }])
    expect(shares[0]).toBeCloseTo(25)
    expect(shares[1]).toBeCloseTo(75)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })
  it('gives a video of unknown length an average share', () => {
    const shares = mergeShares([{ durationSeconds: 60 }, { durationSeconds: 120 }, { durationSeconds: null }])
    expect(shares[2]).toBeCloseTo((90 / 270) * 100)
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100)
  })
  it('splits evenly when nothing is known, and copes with none', () => {
    expect(mergeShares([{ durationSeconds: null }, { durationSeconds: null }])).toEqual([50, 50])
    expect(mergeShares([])).toEqual([])
  })
})

describe('estimateMergeSeconds / describeEstimate', () => {
  it('allows more for a bigger frame', () => {
    expect(estimateMergeSeconds(600, '720p')).toBe(78)
    expect(estimateMergeSeconds(600, '1080p')).toBeGreaterThan(estimateMergeSeconds(600, '720p'))
    expect(estimateMergeSeconds(600, '360p')).toBeLessThan(estimateMergeSeconds(600, '720p'))
  })
  it('puts it in plain words', () => {
    expect(describeEstimate(20)).toBe('under a minute')
    expect(describeEstimate(59)).toBe('under a minute')
    expect(describeEstimate(240)).toBe('about 4 min')
    expect(describeEstimate(4800)).toBe('about 1 h 20 min')
  })
})

describe('sanitizeMergeLook', () => {
  it('keeps valid settings', () => {
    expect(sanitizeMergeLook({ resolution: '1080p', transition: 'FADE' })).toEqual({ resolution: '1080p', transition: 'FADE' })
  })
  it('falls back for anything else', () => {
    expect(sanitizeMergeLook(null)).toEqual({ resolution: '720p', transition: 'NONE' })
    expect(sanitizeMergeLook({ resolution: '4k', transition: 'WIPE' })).toEqual({ resolution: '720p', transition: 'NONE' })
    expect(sanitizeMergeLook('x')).toEqual({ resolution: '720p', transition: 'NONE' })
  })
})
