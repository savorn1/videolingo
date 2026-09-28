// The audio editor's clip list: pieces of the source sound placed on the
// video's timeline. Split, merge, duplicate, move, trim and delete are pure
// operations returning a new list, so they're tested directly; the backend
// renders the list (AudioEditRules) in one ffmpeg pass.

export interface AudioClip {
  id: string
  /** The piece of the source sound, [srcStartMs, srcEndMs). */
  srcStartMs: number
  srcEndMs: number
  /** Where it starts on the video's timeline. */
  atMs: number
  /** 1 = as recorded. */
  gain: number
}

export interface TimeRange {
  startMs: number
  endMs: number
}

export const MAX_AUDIO_CLIPS = 50
/** Pieces shorter than this aren't worth keeping (and can't be grabbed). */
export const MIN_CLIP_MS = 50

let seq = 0
export function newClipId() {
  seq += 1
  return `c${Date.now().toString(36)}${seq}`
}

export function clipLength(c: AudioClip) {
  return c.srcEndMs - c.srcStartMs
}

export function clipEnd(c: AudioClip) {
  return c.atMs + clipLength(c)
}

/** The untouched state: the whole source, from 0. */
export function initialClips(durationMs: number): AudioClip[] {
  return durationMs > 0 ? [{ id: newClipId(), srcStartMs: 0, srcEndMs: durationMs, atMs: 0, gain: 1 }] : []
}

/** Whether the list still just plays the source as-is (then it needn't be sent). */
export function isIdentityClips(clips: AudioClip[], durationMs: number): boolean {
  if (clips.length !== 1) return false
  const c = clips[0]!
  return c.srcStartMs === 0 && c.atMs === 0 && c.gain === 1 && c.srcEndMs >= durationMs
}

function sorted(clips: AudioClip[]) {
  return [...clips].sort((a, b) => a.atMs - b.atMs || a.srcStartMs - b.srcStartMs)
}

/** Cuts the clip under `atMs` (timeline) in two. Unchanged when nothing is there, or a piece would be too short. */
export function splitAt(clips: AudioClip[], id: string, atMs: number): AudioClip[] {
  const c = clips.find((x) => x.id === id)
  if (!c) return clips
  const offset = Math.round(atMs - c.atMs)
  if (offset < MIN_CLIP_MS || clipLength(c) - offset < MIN_CLIP_MS) return clips
  const left: AudioClip = { ...c, srcEndMs: c.srcStartMs + offset }
  const right: AudioClip = { ...c, id: newClipId(), srcStartMs: c.srcStartMs + offset, atMs: c.atMs + offset }
  return sorted(clips.flatMap((x) => (x.id === id ? [left, right] : [x])))
}

/** The clip under a timeline position, preferring the one starting latest (drawn on top). */
export function clipAt(clips: AudioClip[], atMs: number): AudioClip | null {
  const hits = clips.filter((c) => atMs >= c.atMs && atMs < clipEnd(c))
  return hits.sort((a, b) => b.atMs - a.atMs)[0] ?? null
}

/**
 * Joins a clip with the next one on the timeline: the next one moves up to
 * close any gap, and when the two pieces continue each other in the source
 * (e.g. after a split) they become a single clip again.
 */
export function mergeWithNext(clips: AudioClip[], id: string): AudioClip[] {
  const list = sorted(clips)
  const i = list.findIndex((c) => c.id === id)
  const a = list[i]
  const b = list[i + 1]
  if (!a || !b) return clips
  const end = clipEnd(a)
  if (b.srcStartMs === a.srcEndMs && b.gain === a.gain) {
    const joined: AudioClip = { ...a, srcEndMs: b.srcEndMs }
    return list.filter((c) => c.id !== b.id).map((c) => (c.id === a.id ? joined : c))
  }
  return sorted(list.map((c) => (c.id === b.id ? { ...b, atMs: end } : c)))
}

/**
 * A copy right after the original — or, when it wouldn't fit there, ending at
 * the end of the video instead (on a lane of its own where they overlap).
 */
export function duplicate(clips: AudioClip[], id: string, durationMs: number): AudioClip[] {
  const c = clips.find((x) => x.id === id)
  if (!c || clips.length >= MAX_AUDIO_CLIPS) return clips
  const after = clipEnd(c)
  const atMs = after + clipLength(c) <= durationMs ? after : Math.max(0, durationMs - clipLength(c))
  return sorted([...clips, { ...c, id: newClipId(), atMs }])
}

/** Moves a clip to start at `atMs`, kept within the video. */
export function moveTo(clips: AudioClip[], id: string, atMs: number, durationMs: number): AudioClip[] {
  const max = Math.max(0, durationMs - MIN_CLIP_MS)
  return sorted(clips.map((c) => (c.id === id ? { ...c, atMs: Math.round(Math.min(Math.max(0, atMs), max)) } : c)))
}

/**
 * Trims a clip's edges, in timeline terms: `startMs` moves its left edge
 * (the source start follows, so the sound stays where it was), `endMs` its
 * right edge. Clamped to the source and to MIN_CLIP_MS.
 */
export function trimEdges(clips: AudioClip[], id: string, edge: { startMs?: number; endMs?: number }, sourceMs: number): AudioClip[] {
  return clips.map((c) => {
    if (c.id !== id) return c
    let { srcStartMs, srcEndMs, atMs } = c
    if (edge.startMs != null) {
      const delta = Math.round(edge.startMs - c.atMs)
      const clamped = Math.min(Math.max(delta, -c.srcStartMs, -c.atMs), clipLength(c) - MIN_CLIP_MS)
      srcStartMs += clamped
      atMs += clamped
    }
    if (edge.endMs != null) {
      const wanted = srcStartMs + Math.round(edge.endMs - atMs)
      srcEndMs = Math.min(Math.max(wanted, srcStartMs + MIN_CLIP_MS), sourceMs)
    }
    return { ...c, srcStartMs, srcEndMs, atMs }
  })
}

/** Removes the sound in [startMs, endMs) of the timeline from every clip, cutting clips that cross it. */
export function deleteRange(clips: AudioClip[], range: TimeRange): AudioClip[] {
  const { startMs, endMs } = range
  if (endMs <= startMs) return clips
  const out: AudioClip[] = []
  for (const c of clips) {
    const end = clipEnd(c)
    if (end <= startMs || c.atMs >= endMs) {
      out.push(c)
      continue
    }
    if (c.atMs < startMs && startMs - c.atMs >= MIN_CLIP_MS) {
      out.push({ ...c, srcEndMs: c.srcStartMs + (startMs - c.atMs) })
    }
    if (end > endMs && end - endMs >= MIN_CLIP_MS) {
      const cut = endMs - c.atMs
      out.push({ ...c, id: c.atMs < startMs ? newClipId() : c.id, srcStartMs: c.srcStartMs + cut, atMs: endMs })
    }
  }
  return sorted(out)
}

/** Lane per clip, so overlapping clips (e.g. a duplicate moved on top) are drawn on separate rows. */
export function assignLanes(clips: AudioClip[]): Map<string, number> {
  const lanes: number[] = []
  const result = new Map<string, number>()
  for (const c of sorted(clips)) {
    let lane = lanes.findIndex((end) => end <= c.atMs)
    if (lane === -1) {
      lane = lanes.length
      lanes.push(0)
    }
    lanes[lane] = clipEnd(c)
    result.set(c.id, lane)
  }
  return result
}

/** Adds a muted range, merging it with any it overlaps. */
export function addMute(mutes: TimeRange[], range: TimeRange): TimeRange[] {
  if (range.endMs <= range.startMs) return mutes
  const all = [...mutes, range].sort((a, b) => a.startMs - b.startMs)
  const merged: TimeRange[] = []
  for (const r of all) {
    const last = merged[merged.length - 1]
    if (last && r.startMs <= last.endMs) last.endMs = Math.max(last.endMs, r.endMs)
    else merged.push({ ...r })
  }
  return merged
}

/** Why the clips can't be rendered, or null. The server checks the same (AudioEditRules). */
export function validateClips(clips: AudioClip[], durationMs: number): string | null {
  if (clips.length > MAX_AUDIO_CLIPS) return `At most ${MAX_AUDIO_CLIPS} audio clips`
  const i = clips.findIndex((c) => durationMs > 0 && c.atMs >= durationMs)
  if (i >= 0) return `Audio clip ${i + 1} starts after the end of the video — move it back`
  return null
}

export function isMutedAt(mutes: TimeRange[], ms: number) {
  return mutes.some((r) => ms >= r.startMs && ms < r.endMs)
}
