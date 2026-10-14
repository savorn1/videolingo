// Motion & effects on a trim (the Trim tab): an effect, fades, a held frame, part of the clip at another speed,
// played backwards, steadied, zoomed into an area, and a green screen. Times are on the trimmed clip (0 = the
// range's start). Mirrors backend VideoEditRules (validateEffect/Fade/Freeze/SpeedRange/Reverse/ZoomTo/GreenScreen),
// which re-checks everything.

export const TRIM_EFFECTS = [
  { value: 'NONE', label: 'None' },
  { value: 'ZOOM_IN', label: 'Slow zoom in' },
  { value: 'ZOOM_OUT', label: 'Slow zoom out' },
  { value: 'GLITCH', label: 'Glitch' },
  { value: 'OLD_FILM', label: 'Old film' }
] as const
export type TrimEffect = (typeof TRIM_EFFECTS)[number]['value']

/** The speeds a part of the clip can play at (backend RAMP_SPEEDS). */
export const RAMP_SPEEDS = [0.25, 0.5, 0.75, 1.5, 2, 4] as const
export const MIN_RAMP_MS = 500
/** At most this many parts at another speed in one trim (backend VideoEditRules.MAX_SPEED_PARTS). */
export const MAX_SPEED_PARTS = 10
export const MAX_TRIM_FADE_MS = 5000
export const MIN_FREEZE_MS = 500
export const MAX_FREEZE_MS = 10_000
/** Playing backwards holds the clip in memory, so only short clips (backend MAX_REVERSE_MS). */
export const MAX_REVERSE_MS = 60_000
/** At most this many pauses in one trim, at least MIN_FREEZE_MS apart (backend VideoEditRules.MAX_HOLDS). */
export const MAX_HOLDS = 60
export const MIN_ZOOM_SIZE = 0.25
export const MAX_ZOOM_SIZE = 0.95
export const MIN_KEY_SIMILARITY = 0.05
export const MAX_KEY_SIMILARITY = 0.6

export interface SpeedPart {
  startMs: number
  endMs: number
  speed: number
}

export interface VideoMotion {
  effect: TrimEffect
  fadeInMs: number
  fadeOutMs: number
  fadeColor: 'BLACK' | 'WHITE'
  freeze: { atMs: number; durationMs: number } | null
  /** Pauses on the last frame (e.g. after each sentence), in time order. */
  holds: { atMs: number; durationMs: number }[]
  /** Parts played at another speed; they mustn't overlap. */
  speeds: SpeedPart[]
  reverse: boolean
  stabilize: boolean
  /** Zoom from the whole picture into this area: its centre (0–1) and final size (a fraction of the picture). */
  zoomTo: { cx: number; cy: number; size: number } | null
  greenScreen: { keyColor: string; similarity: number; background: string } | null
}

export const PLAIN_MOTION: VideoMotion = {
  effect: 'NONE',
  fadeInMs: 0,
  fadeOutMs: 0,
  fadeColor: 'BLACK',
  freeze: null,
  holds: [],
  speeds: [],
  reverse: false,
  stabilize: false,
  zoomTo: null,
  greenScreen: null
}

export function isPlainMotion(m: VideoMotion): boolean {
  return (
    m.effect === 'NONE' &&
    !m.fadeInMs &&
    !m.fadeOutMs &&
    !m.freeze &&
    !m.holds.length &&
    !m.speeds.length &&
    !m.reverse &&
    !m.stabilize &&
    !m.zoomTo &&
    !m.greenScreen
  )
}

const HEX = /^#[0-9a-f]{6}$/i

/** Why the motion settings can't be rendered on a clip `clipMs` long (as the server will say), or null. */
export function motionProblem(m: VideoMotion, clipMs: number | null): string | null {
  if (m.fadeInMs < 0 || m.fadeInMs > MAX_TRIM_FADE_MS || m.fadeOutMs < 0 || m.fadeOutMs > MAX_TRIM_FADE_MS)
    return `A fade is between 0 and ${MAX_TRIM_FADE_MS / 1000} s`
  if (clipMs && m.fadeInMs + m.fadeOutMs > clipMs) return "The fade in and fade out together can't be longer than the clip"
  if (m.freeze) {
    if (m.freeze.durationMs < MIN_FREEZE_MS || m.freeze.durationMs > MAX_FREEZE_MS) return `A freeze lasts between 0.5 and ${MAX_FREEZE_MS / 1000} s`
    if (m.freeze.atMs <= 0) return 'Freeze a frame after the start of the clip'
    if (clipMs && m.freeze.atMs >= clipMs) return 'Freeze a frame before the end of the clip'
  }
  if (m.holds.length > MAX_HOLDS) return `At most ${MAX_HOLDS} pauses in one trim`
  for (let i = 0; i < m.holds.length; i++) {
    const h = m.holds[i]!
    if (h.durationMs < MIN_FREEZE_MS || h.durationMs > MAX_FREEZE_MS) return `A pause lasts between 0.5 and ${MAX_FREEZE_MS / 1000} s`
    if (h.atMs <= 0 || (clipMs && h.atMs >= clipMs)) return `Pause ${i + 1} is outside the clip`
    if (i && h.atMs - m.holds[i - 1]!.atMs < MIN_FREEZE_MS) return 'Pauses must be in time order, at least 0.5 s apart'
  }
  if (m.speeds.length > MAX_SPEED_PARTS) return `At most ${MAX_SPEED_PARTS} parts at another speed`
  const parts = sortedSpeeds(m.speeds)
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!
    const which = parts.length > 1 ? `Speed part ${i + 1}: ` : ''
    if (!(RAMP_SPEEDS as readonly number[]).includes(p.speed)) return `${which}pick a speed: 0.25×, 0.5×, 0.75×, 1.5×, 2× or 4×`
    if (p.startMs < 0 || p.endMs - p.startMs < MIN_RAMP_MS) return `${which}the part to speed up or slow down must be at least 0.5 s long`
    if (clipMs && p.endMs > clipMs) return `${which}the part to speed up or slow down runs past the end of the clip`
    if (i && p.startMs < parts[i - 1]!.endMs) return "The parts at another speed overlap — move one so they don't"
  }
  if (m.reverse && clipMs && clipMs > MAX_REVERSE_MS) return `Only a clip up to ${MAX_REVERSE_MS / 1000} s can be played backwards — trim it shorter`
  if (m.zoomTo) {
    const z = m.zoomTo
    if (z.cx < 0 || z.cx > 1 || z.cy < 0 || z.cy > 1) return 'Zoom: the area must be inside the picture'
    if (z.size < MIN_ZOOM_SIZE || z.size > MAX_ZOOM_SIZE) return 'Zoom: the area is between 25% and 95% of the picture'
  }
  if (m.greenScreen) {
    const g = m.greenScreen
    if (!HEX.test(g.keyColor) || !HEX.test(g.background)) return 'Green screen: pick the colours'
    if (g.similarity < MIN_KEY_SIMILARITY || g.similarity > MAX_KEY_SIMILARITY) return 'Green screen: the tolerance is between 5 and 60'
  }
  return null
}

/** The trim request's fields for the motion settings; the ones not in use are left out. */
export function motionRequest(m: VideoMotion) {
  return {
    ...(m.effect !== 'NONE' ? { effect: m.effect } : {}),
    ...(m.fadeInMs || m.fadeOutMs ? { fade: { inMs: m.fadeInMs, outMs: m.fadeOutMs, color: m.fadeColor } } : {}),
    ...(m.freeze ? { freeze: { ...m.freeze } } : {}),
    ...(m.holds.length ? { holds: m.holds.map((h) => ({ ...h })) } : {}),
    ...(m.speeds.length ? { speeds: sortedSpeeds(m.speeds) } : {}),
    ...(m.reverse ? { reverse: true } : {}),
    ...(m.stabilize ? { stabilize: true } : {}),
    ...(m.zoomTo ? { zoomTo: { ...m.zoomTo } } : {}),
    ...(m.greenScreen ? { greenScreen: { ...m.greenScreen } } : {})
  }
}

/** "slow zoom in, held 2 s, backwards" — what the motion settings do, for the trim summary; null for none. */
export function describeMotion(m: VideoMotion): string | null {
  const parts: string[] = []
  if (m.effect !== 'NONE') parts.push(TRIM_EFFECTS.find((e) => e.value === m.effect)!.label.toLowerCase())
  if (m.fadeInMs || m.fadeOutMs) parts.push(`fades${m.fadeColor === 'WHITE' ? ' (white)' : ''}`)
  if (m.freeze) parts.push(`frame held ${m.freeze.durationMs / 1000} s`)
  if (m.holds.length) parts.push(`${m.holds.length} pause${m.holds.length === 1 ? '' : 's'}`)
  if (m.speeds.length === 1) {
    const p = m.speeds[0]!
    parts.push(`${p.speed < 1 ? 'slow motion' : 'sped up'} ${p.speed}× for ${(p.endMs - p.startMs) / 1000} s`)
  } else if (m.speeds.length) parts.push(`${m.speeds.length} parts at another speed`)
  if (m.reverse) parts.push('backwards')
  if (m.stabilize) parts.push('steadied')
  if (m.zoomTo) parts.push(`zoom into ${Math.round(m.zoomTo.size * 100)}%`)
  if (m.greenScreen) parts.push('green screen')
  return parts.length ? parts.join(', ') : null
}

/** Motion settings from a draft saved by any version (missing parts are plain). */
export function sanitizeMotion(raw: unknown): VideoMotion {
  const { speed, ...m } =
    raw && typeof raw === 'object' ? { ...PLAIN_MOTION, ...(raw as Partial<VideoMotion> & { speed?: SpeedPart | null }) } : { ...PLAIN_MOTION, speed: null }
  const ok = (p: SpeedPart | null | undefined): p is SpeedPart => !!p && Number.isFinite(p.startMs) && Number.isFinite(p.endMs) && Number.isFinite(p.speed)
  return {
    ...m,
    holds: Array.isArray(m.holds) ? m.holds.filter((h) => Number.isFinite(h?.atMs) && Number.isFinite(h?.durationMs)) : [],
    // Drafts from before several parts kept one `speed`.
    speeds: Array.isArray((raw as Partial<VideoMotion> | null)?.speeds) ? m.speeds.filter(ok) : ok(speed) ? [speed] : []
  }
}

/** The speed parts in time order (copies). */
export function sortedSpeeds(parts: SpeedPart[]): SpeedPart[] {
  return parts.map((p) => ({ ...p })).sort((a, b) => a.startMs - b.startMs)
}

/**
 * A new 2 s slow-motion part at `atMs` (on the trimmed clip), moved to the first free stretch from there so it doesn't
 * overlap the others, and cut short at the clip's end; null when there's no room for one (≥ MIN_RAMP_MS).
 */
export function nextSpeedPart(parts: SpeedPart[], atMs: number, clipMs: number): SpeedPart | null {
  if (parts.length >= MAX_SPEED_PARTS) return null
  let start = Math.max(0, atMs)
  for (const p of sortedSpeeds(parts)) {
    if (p.endMs <= start) continue
    if (p.startMs - start >= MIN_RAMP_MS) break
    start = Math.max(start, p.endMs)
  }
  const next = sortedSpeeds(parts).find((p) => p.startMs >= start)
  const end = Math.min(start + 2000, next ? next.startMs : clipMs, clipMs)
  return end - start >= MIN_RAMP_MS ? { startMs: start, endMs: end, speed: 0.5 } : null
}

/**
 * "Pause after each sentence": a pause of `holdMs` at the end of each sentence that ends inside the trimmed range
 * (`startMs`–`endMs` of the video), on the trimmed clip's time. Not at the very end (nothing follows), at least
 * MIN_FREEZE_MS apart (a sentence ending too soon after the last pause is skipped), and at most MAX_HOLDS.
 */
export function sentencePauses(sentences: { endMs: number }[], startMs: number, endMs: number, holdMs: number): { atMs: number; durationMs: number }[] {
  const out: { atMs: number; durationMs: number }[] = []
  const ends = sentences.map((s) => s.endMs - startMs).sort((a, b) => a - b)
  for (const at of ends) {
    if (out.length >= MAX_HOLDS) break
    if (at < MIN_FREEZE_MS || at > endMs - startMs - MIN_FREEZE_MS) continue
    if (out.length && at - out[out.length - 1]!.atMs < MIN_FREEZE_MS) continue
    out.push({ atMs: Math.round(at), durationMs: holdMs })
  }
  return out
}
