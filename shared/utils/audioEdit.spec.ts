import { describe, expect, it } from 'vitest'
import {
  addMute,
  assignLanes,
  clipAt,
  deleteRange,
  duplicate,
  initialClips,
  isIdentityClips,
  isMutedAt,
  mergeWithNext,
  moveTo,
  splitAt,
  trimEdges,
  validateClips,
  type AudioClip
} from './audioEdit'

const clip = (id: string, srcStartMs: number, srcEndMs: number, atMs: number, gain = 1): AudioClip => ({ id, srcStartMs, srcEndMs, atMs, gain })
const shape = (clips: AudioClip[]) => clips.map((c) => [c.srcStartMs, c.srcEndMs, c.atMs])

describe('initialClips / isIdentityClips', () => {
  it('starts as the whole source and knows when nothing changed', () => {
    const c = initialClips(10_000)
    expect(shape(c)).toEqual([[0, 10_000, 0]])
    expect(isIdentityClips(c, 10_000)).toBe(true)
    expect(isIdentityClips([{ ...c[0]!, gain: 0.5 }], 10_000)).toBe(false)
    expect(initialClips(0)).toEqual([])
  })
})

describe('splitAt', () => {
  it('cuts a clip in two at a timeline position', () => {
    const out = splitAt([clip('a', 1000, 9000, 2000)], 'a', 5000)
    expect(shape(out)).toEqual([
      [1000, 4000, 2000],
      [4000, 9000, 5000]
    ])
    expect(out[0]!.id).toBe('a')
    expect(out[1]!.id).not.toBe('a')
  })
  it('refuses slivers', () => {
    const list = [clip('a', 0, 1000, 0)]
    expect(splitAt(list, 'a', 20)).toBe(list)
    expect(splitAt(list, 'a', 990)).toBe(list)
  })
})

describe('mergeWithNext', () => {
  it('re-joins pieces that continue each other', () => {
    const split = splitAt([clip('a', 0, 10_000, 0)], 'a', 4000)
    expect(shape(mergeWithNext(split, 'a'))).toEqual([[0, 10_000, 0]])
  })
  it('closes the gap to an unrelated next clip', () => {
    const out = mergeWithNext([clip('a', 0, 2000, 0), clip('b', 6000, 7000, 5000)], 'a')
    expect(shape(out)).toEqual([
      [0, 2000, 0],
      [6000, 7000, 2000]
    ])
  })
  it('does nothing for the last clip', () => {
    const list = [clip('a', 0, 2000, 0)]
    expect(mergeWithNext(list, 'a')).toBe(list)
  })
})

describe('duplicate / moveTo', () => {
  it('places a copy right after the original', () => {
    const out = duplicate([clip('a', 1000, 3000, 500)], 'a', 10_000)
    expect(shape(out)).toEqual([
      [1000, 3000, 500],
      [1000, 3000, 2500]
    ])
  })
  it('keeps the copy inside the video when it would not fit after the original', () => {
    expect(shape(duplicate([clip('a', 0, 3000, 5000)], 'a', 10_000))).toEqual([
      [0, 3000, 5000],
      [0, 3000, 7000]
    ])
    const out = duplicate([clip('a', 0, 4000, 7000)], 'a', 10_000)
    expect(shape(out)).toEqual([
      [0, 4000, 6000],
      [0, 4000, 7000]
    ])
  })
  it('moves within the video', () => {
    expect(shape(moveTo([clip('a', 0, 1000, 0)], 'a', 4200, 10_000))).toEqual([[0, 1000, 4200]])
    expect(moveTo([clip('a', 0, 1000, 0)], 'a', -50, 10_000)[0]!.atMs).toBe(0)
    expect(moveTo([clip('a', 0, 1000, 0)], 'a', 20_000, 10_000)[0]!.atMs).toBe(9950)
  })
})

describe('trimEdges', () => {
  it('moves the left edge with the source, so the sound stays put', () => {
    const out = trimEdges([clip('a', 1000, 5000, 2000)], 'a', { startMs: 2500 }, 10_000)
    expect(shape(out)).toEqual([[1500, 5000, 2500]])
  })
  it("can't pull the left edge past the source start or the timeline start", () => {
    expect(shape(trimEdges([clip('a', 1000, 5000, 2000)], 'a', { startMs: 0 }, 10_000))).toEqual([[0, 5000, 1000]])
    expect(shape(trimEdges([clip('a', 3000, 5000, 500)], 'a', { startMs: 0 }, 10_000))).toEqual([[2500, 5000, 0]])
  })
  it('moves the right edge within the source', () => {
    expect(shape(trimEdges([clip('a', 1000, 5000, 2000)], 'a', { endMs: 4000 }, 10_000))).toEqual([[1000, 3000, 2000]])
    expect(shape(trimEdges([clip('a', 1000, 5000, 2000)], 'a', { endMs: 50_000 }, 10_000))).toEqual([[1000, 10_000, 2000]])
    expect(shape(trimEdges([clip('a', 1000, 5000, 2000)], 'a', { endMs: 0 }, 10_000))).toEqual([[1000, 1050, 2000]])
  })
})

describe('deleteRange', () => {
  it('cuts a hole in a clip', () => {
    const out = deleteRange([clip('a', 0, 10_000, 0)], { startMs: 3000, endMs: 5000 })
    expect(shape(out)).toEqual([
      [0, 3000, 0],
      [5000, 10_000, 5000]
    ])
  })
  it('drops clips inside the range and trims those crossing an edge', () => {
    const out = deleteRange([clip('a', 0, 2000, 0), clip('b', 0, 1000, 2500), clip('c', 0, 2000, 4000)], { startMs: 1000, endMs: 5000 })
    expect(shape(out)).toEqual([
      [0, 1000, 0],
      [1000, 2000, 5000]
    ])
  })
})

describe('clipAt / assignLanes', () => {
  it('finds the clip under a position, preferring the later one', () => {
    const list = [clip('a', 0, 5000, 0), clip('b', 0, 2000, 3000)]
    expect(clipAt(list, 1000)?.id).toBe('a')
    expect(clipAt(list, 4000)?.id).toBe('b')
    expect(clipAt(list, 9000)).toBeNull()
  })
  it('puts overlapping clips on separate lanes', () => {
    const lanes = assignLanes([clip('a', 0, 5000, 0), clip('b', 0, 2000, 3000), clip('c', 0, 1000, 6000)])
    expect([lanes.get('a'), lanes.get('b'), lanes.get('c')]).toEqual([0, 1, 0])
  })
})

describe('validateClips', () => {
  it('rejects a clip starting after the end of the video', () => {
    expect(validateClips([clip('a', 0, 1000, 0)], 10_000)).toBeNull()
    expect(validateClips([clip('a', 0, 1000, 0), clip('b', 0, 1000, 10_000)], 10_000)).toMatch(/clip 2/)
  })
})

describe('addMute / isMutedAt', () => {
  it('merges overlapping ranges', () => {
    const m = addMute(addMute([], { startMs: 1000, endMs: 3000 }), { startMs: 2500, endMs: 4000 })
    expect(m).toEqual([{ startMs: 1000, endMs: 4000 }])
    expect(isMutedAt(m, 3999)).toBe(true)
    expect(isMutedAt(m, 4000)).toBe(false)
  })
})
