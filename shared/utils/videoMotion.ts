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
export const MAX_TRIM_FADE_MS = 5000
export const MIN_FREEZE_MS = 500
export const MAX_FREEZE_MS = 10_000
/** Playing backwards holds the clip in memory, so only short clips (backend MAX_REVERSE_MS). */
export const MAX_REVERSE_MS = 60_000
export const MIN_ZOOM_SIZE = 0.25
export const MAX_ZOOM_SIZE = 0.95
export const MIN_KEY_SIMILARITY = 0.05
export const MAX_KEY_SIMILARITY = 0.6

export interface VideoMotion {
  effect: TrimEffect
  fadeInMs: number
  fadeOutMs: number
  fadeColor: 'BLACK' | 'WHITE'
  freeze: { atMs: number; durationMs: number } | null
  speed: { startMs: number; endMs: number; speed: number } | null
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
  speed: null,
  reverse: false,
  stabilize: false,
  zoomTo: null,
  greenScreen: null
}

export function isPlainMotion(m: VideoMotion): boolean {
  return m.effect === 'NONE' && !m.fadeInMs && !m.fadeOutMs && !m.freeze && !m.speed && !m.reverse && !m.stabilize && !m.zoomTo && !m.greenScreen
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
  if (m.speed) {
    if (!(RAMP_SPEEDS as readonly number[]).includes(m.speed.speed)) return 'Pick a speed: 0.25×, 0.5×, 0.75×, 1.5×, 2× or 4×'
    if (m.speed.startMs < 0 || m.speed.endMs - m.speed.startMs < MIN_RAMP_MS) return 'The part to speed up or slow down must be at least 0.5 s long'
    if (clipMs && m.speed.endMs > clipMs) return 'The part to speed up or slow down runs past the end of the clip'
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
    ...(m.speed ? { speed: { ...m.speed } } : {}),
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
  if (m.speed) parts.push(`${m.speed.speed < 1 ? 'slow motion' : 'sped up'} ${m.speed.speed}× for ${(m.speed.endMs - m.speed.startMs) / 1000} s`)
  if (m.reverse) parts.push('backwards')
  if (m.stabilize) parts.push('steadied')
  if (m.zoomTo) parts.push(`zoom into ${Math.round(m.zoomTo.size * 100)}%`)
  if (m.greenScreen) parts.push('green screen')
  return parts.length ? parts.join(', ') : null
}

/** Motion settings from a draft saved by any version (missing parts are plain). */
export function sanitizeMotion(raw: unknown): VideoMotion {
  return raw && typeof raw === 'object' ? { ...PLAIN_MOTION, ...(raw as Partial<VideoMotion>) } : { ...PLAIN_MOTION }
}
