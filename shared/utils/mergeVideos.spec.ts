import { describe, expect, it } from 'vitest'
import { blockedReason, defaultMergeTitle, MAX_MERGE_SECONDS, MAX_MERGE_VIDEOS, mergeProblem, mergeTotals, type MergeItem } from './mergeVideos'

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
