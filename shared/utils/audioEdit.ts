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

/**
 * Where the background music is at a point of the video, in ms into the music file, or null while it is silent:
 * before it starts, or after it ends when it doesn't loop. An unknown music length plays on (looping is left to the player).
 */
export function musicPositionAt(music: { startMs: number; loop: boolean; durationMs: number | null }, videoMs: number): number | null {
  const into = videoMs - music.startMs
  if (into < 0) return null
  const length = music.durationMs
  if (!length || length <= 0) return into
  if (music.loop) return into % length
  return into < length ? into : null
}

/** At most this many loop rounds are drawn; past it the last one runs to the end. */
const MAX_MUSIC_SPANS = 100

/**
 * Where the background music plays on the video's timeline: one span per loop round (or just one), cut at the
 * video's end. An unknown length is drawn as one span to the end.
 */
export function musicSpans(music: { startMs: number; loop: boolean; durationMs: number | null }, durationMs: number): TimeRange[] {
  const start = Math.max(0, music.startMs)
  if (durationMs <= 0 || start >= durationMs) return []
  const length = music.durationMs
  if (!length || length <= 0) return [{ startMs: start, endMs: durationMs }]
  if (!music.loop) return [{ startMs: start, endMs: Math.min(durationMs, start + length) }]
  const spans: TimeRange[] = []
  for (let at = start; at < durationMs; at += length) {
    if (spans.length === MAX_MUSIC_SPANS - 1) {
      spans.push({ startMs: at, endMs: durationMs })
      break
    }
    spans.push({ startMs: at, endMs: Math.min(durationMs, at + length) })
  }
  return spans
}

/** The longest fade the form takes, in or out. */
export const MAX_FADE_MS = 60_000

/**
 * A fade's length from where its handle is dragged to on the video's timeline: from the start for the fade-in,
 * to the end for the fade-out. On the finished timeline (so divided by the speed), to 0.1 s, at most MAX_FADE_MS,
 * and never so long that the two fades together outlast the result.
 */
export function fadeFromHandle(edge: 'in' | 'out', videoMs: number, s: { fadeInMs: number; fadeOutMs: number; speed: number }, durationMs: number): number {
  const speed = s.speed > 0 ? s.speed : 1
  const raw = (edge === 'in' ? videoMs : durationMs - videoMs) / speed
  const room = durationMs / speed - (edge === 'in' ? s.fadeOutMs : s.fadeInMs)
  const max = Math.max(0, Math.min(MAX_FADE_MS, room))
  return Math.min(max, Math.max(0, Math.round(raw / 100) * 100))
}

/** The fades on the video's timeline (they are set on the finished one, which the speed change stretches or shortens). */
export function fadeSpans(
  s: { fadeInMs: number; fadeOutMs: number; speed: number },
  durationMs: number
): { fadeIn: TimeRange | null; fadeOut: TimeRange | null } {
  const speed = s.speed > 0 ? s.speed : 1
  const inMs = Math.min(durationMs, s.fadeInMs * speed)
  const outMs = Math.min(durationMs, s.fadeOutMs * speed)
  return {
    fadeIn: inMs > 0 ? { startMs: 0, endMs: inMs } : null,
    fadeOut: outMs > 0 ? { startMs: durationMs - outMs, endMs: durationMs } : null
  }
}

/**
 * The level the live preview plays at a point of the video (0–1): the volume (the player can't go above 100 %),
 * the muted ranges, and the fades. The fades are linear, as ffmpeg's afade, and sit on the finished video's
 * timeline, which a speed change stretches or shortens.
 */
export function previewGainAt(
  s: { volume: number; mutes: TimeRange[]; fadeInMs: number; fadeOutMs: number; speed: number },
  durationMs: number,
  ms: number
): number {
  if (s.volume <= 0 || isMutedAt(s.mutes, ms)) return 0
  const speed = s.speed > 0 ? s.speed : 1
  const outMs = ms / speed
  const outLength = durationMs / speed
  let fade = 1
  if (s.fadeInMs > 0) fade = Math.min(fade, outMs / s.fadeInMs)
  if (s.fadeOutMs > 0 && outLength > 0) fade = Math.min(fade, (outLength - outMs) / s.fadeOutMs)
  return Math.max(0, Math.min(1, s.volume * Math.max(0, fade)))
}
