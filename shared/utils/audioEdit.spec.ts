import { describe, expect, it } from 'vitest'
import {
  previewGainAt,
  soundTracksProblem,
  musicPositionAt,
  musicSpans,
  fadeSpans,
  fadeFromHandle,
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

describe('previewGainAt', () => {
  const base = { volume: 1, mutes: [], fadeInMs: 0, fadeOutMs: 0, speed: 1 }
  it('plays the volume, up to 100 %, and silences muted ranges', () => {
    expect(previewGainAt(base, 10_000, 5000)).toBe(1)
    expect(previewGainAt({ ...base, volume: 0.5 }, 10_000, 5000)).toBe(0.5)
    expect(previewGainAt({ ...base, volume: 2 }, 10_000, 5000)).toBe(1)
    expect(previewGainAt({ ...base, mutes: [{ startMs: 4000, endMs: 6000 }] }, 10_000, 5000)).toBe(0)
  })
  it('fades in from the start and out to the end', () => {
    const s = { ...base, fadeInMs: 2000, fadeOutMs: 4000 }
    expect(previewGainAt(s, 10_000, 0)).toBe(0)
    expect(previewGainAt(s, 10_000, 1000)).toBe(0.5)
    expect(previewGainAt(s, 10_000, 5000)).toBe(1)
    expect(previewGainAt(s, 10_000, 8000)).toBe(0.5)
    expect(previewGainAt(s, 10_000, 10_000)).toBe(0)
  })
  it('places the fades on the finished timeline when the speed changes', () => {
    // At 2× the 10 s video lasts 5 s; a 1 s fade-in covers the first 2 s of the source.
    expect(previewGainAt({ ...base, fadeInMs: 1000, speed: 2 }, 10_000, 1000)).toBe(0.5)
    expect(previewGainAt({ ...base, fadeOutMs: 1000, speed: 2 }, 10_000, 9000)).toBe(0.5)
  })
})

describe('musicPositionAt', () => {
  const music = { startMs: 2000, loop: false, durationMs: 5000 }
  it('is silent before the music starts', () => {
    expect(musicPositionAt(music, 1000)).toBeNull()
    expect(musicPositionAt(music, 2000)).toBe(0)
  })
  it('stops at its end, or goes round when looping', () => {
    expect(musicPositionAt(music, 6500)).toBe(4500)
    expect(musicPositionAt(music, 7000)).toBeNull()
    expect(musicPositionAt({ ...music, loop: true }, 8000)).toBe(1000)
  })
  it('plays on when its length is unknown', () => {
    expect(musicPositionAt({ ...music, durationMs: null }, 12_000)).toBe(10_000)
  })
})

describe('musicSpans', () => {
  it('is one span, cut at the video end, without looping', () => {
    expect(musicSpans({ startMs: 2000, loop: false, durationMs: 5000 }, 10_000)).toEqual([{ startMs: 2000, endMs: 7000 }])
    expect(musicSpans({ startMs: 8000, loop: false, durationMs: 5000 }, 10_000)).toEqual([{ startMs: 8000, endMs: 10_000 }])
  })
  it('is one span per loop round', () => {
    expect(musicSpans({ startMs: 1000, loop: true, durationMs: 4000 }, 10_000)).toEqual([
      { startMs: 1000, endMs: 5000 },
      { startMs: 5000, endMs: 9000 },
      { startMs: 9000, endMs: 10_000 }
    ])
  })
  it('caps the rounds, the last one running to the end', () => {
    const spans = musicSpans({ startMs: 0, loop: true, durationMs: 10 }, 10_000)
    expect(spans).toHaveLength(100)
    expect(spans.at(-1)!.endMs).toBe(10_000)
  })
  it('is nothing when it starts after the end, and runs to the end when its length is unknown', () => {
    expect(musicSpans({ startMs: 12_000, loop: true, durationMs: 4000 }, 10_000)).toEqual([])
    expect(musicSpans({ startMs: 0, loop: false, durationMs: null }, 10_000)).toEqual([{ startMs: 0, endMs: 10_000 }])
  })
})

describe('fadeSpans', () => {
  it('places the fades at the ends, stretched by the speed', () => {
    expect(fadeSpans({ fadeInMs: 1000, fadeOutMs: 2000, speed: 1 }, 10_000)).toEqual({
      fadeIn: { startMs: 0, endMs: 1000 },
      fadeOut: { startMs: 8000, endMs: 10_000 }
    })
    expect(fadeSpans({ fadeInMs: 1000, fadeOutMs: 0, speed: 2 }, 10_000)).toEqual({ fadeIn: { startMs: 0, endMs: 2000 }, fadeOut: null })
  })
})

describe('fadeFromHandle', () => {
  const s = { fadeInMs: 0, fadeOutMs: 0, speed: 1 }
  it('measures the fade-in from the start and the fade-out to the end, to 0.1 s', () => {
    expect(fadeFromHandle('in', 2340, s, 10_000)).toBe(2300)
    expect(fadeFromHandle('out', 7000, s, 10_000)).toBe(3000)
    expect(fadeFromHandle('in', -500, s, 10_000)).toBe(0)
  })
  it('is on the finished timeline after a speed change', () => {
    expect(fadeFromHandle('in', 4000, { ...s, speed: 2 }, 10_000)).toBe(2000)
  })
  it('leaves room for the other fade, and stops at a minute', () => {
    expect(fadeFromHandle('in', 9000, { ...s, fadeOutMs: 4000 }, 10_000)).toBe(6000)
    expect(fadeFromHandle('in', 90_000, s, 120_000)).toBe(60_000)
  })
})

describe('soundTracksProblem', () => {
  const t = { startMs: 0, volume: 1 }
  it('accepts up to four tracks within the video', () => {
    expect(soundTracksProblem([t, t, t, t], 10_000)).toBeNull()
  })
  it('says what is wrong, numbering the track', () => {
    expect(soundTracksProblem([t, t, t, t, t], 10_000)).toBe('At most 4 extra sound tracks')
    expect(soundTracksProblem([t, { startMs: 0, volume: 3 }], 10_000)).toBe('Sound track 2: volume must be between 0% and 200%')
    expect(soundTracksProblem([{ startMs: 12_000, volume: 1 }], 10_000)).toBe('Sound track 1 must start within the video')
  })
})
