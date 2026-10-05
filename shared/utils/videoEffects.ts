// An effect and a transition (fade in / fade out) for a trim. The backend renders
// them (VideoEditRules.EFFECTS / Fade + ffmpeg) and re-checks them; the preview
// shows the zooms, the fades and a close look for old film, but not the glitch.

export type VideoEffect = 'NONE' | 'ZOOM_IN' | 'ZOOM_OUT' | 'GLITCH' | 'OLD_FILM'

export const VIDEO_EFFECTS: { value: VideoEffect; label: string; icon: string; hint: string }[] = [
  { value: 'NONE', label: 'None', icon: 'i-lucide-circle-off', hint: 'No effect' },
  { value: 'ZOOM_IN', label: 'Zoom in', icon: 'i-lucide-zoom-in', hint: 'Slowly pushes in on the centre over the clip' },
  { value: 'ZOOM_OUT', label: 'Zoom out', icon: 'i-lucide-zoom-out', hint: 'Starts close on the centre and slowly pulls back' },
  { value: 'GLITCH', label: 'Glitch', icon: 'i-lucide-zap', hint: 'Split colour edges and digital noise (only in the result)' },
  { value: 'OLD_FILM', label: 'Old film', icon: 'i-lucide-film', hint: 'Sepia, grain, dark corners and a light flicker' }
]

/** How far a slow zoom goes (mirrors VideoEditRules.ZOOM_AMOUNT): the picture ends (or starts) 20 % larger. */
export const ZOOM_AMOUNT = 0.2

/** Mirrors VideoEditRules.MAX_FADE_MS. */
export const MAX_FADE_MS = 5000

export interface ClipFade {
  inMs: number
  outMs: number
  color: 'BLACK' | 'WHITE'
}

export const NO_FADE: ClipFade = { inMs: 0, outMs: 0, color: 'BLACK' }

export function isNoFade(fade: ClipFade | null | undefined): boolean {
  return !fade || (!fade.inMs && !fade.outMs)
}

/** Null = fine. `lengthMs` is the clip's length: the two fades together must fit in it. */
export function validateFade(fade: ClipFade | null | undefined, lengthMs: number | null): string | null {
  if (isNoFade(fade)) return null
  const f = fade!
  if (!(f.inMs >= 0 && f.inMs <= MAX_FADE_MS && f.outMs >= 0 && f.outMs <= MAX_FADE_MS)) return `A fade is between 0 and ${MAX_FADE_MS / 1000} s`
  if (lengthMs != null && f.inMs + f.outMs > lengthMs) return "The fade in and fade out together can't be longer than the clip"
  return null
}

/** The `fade` part of a trim request: null when there is none, so a plain trim is sent as before. */
export function fadeRequest(fade: ClipFade | null | undefined): ClipFade | null {
  return isNoFade(fade) ? null : { inMs: Math.round(fade!.inMs), outMs: Math.round(fade!.outMs), color: fade!.color }
}

/** The `effect` part of a trim request: left out for none. */
export function effectRequest(effect: VideoEffect): Exclude<VideoEffect, 'NONE'> | undefined {
  return effect === 'NONE' ? undefined : effect
}

/** For the trim summary, e.g. "slow zoom in"; null for none (same words as the server's summary). */
export function describeEffect(effect: VideoEffect): string | null {
  switch (effect) {
    case 'ZOOM_IN':
      return 'slow zoom in'
    case 'ZOOM_OUT':
      return 'slow zoom out'
    case 'GLITCH':
      return 'glitch'
    case 'OLD_FILM':
      return 'old film'
    default:
      return null
  }
}

const seconds = (ms: number) => `${+(ms / 1000).toFixed(1)} s`

/** "fade in 1 s, fade out 0.5 s (white)"; null for none. */
export function describeFade(fade: ClipFade | null | undefined): string | null {
  if (isNoFade(fade)) return null
  const f = fade!
  const parts: string[] = []
  if (f.inMs > 0) parts.push(`fade in ${seconds(f.inMs)}`)
  if (f.outMs > 0) parts.push(`fade out ${seconds(f.outMs)}`)
  return parts.join(', ') + (f.color === 'WHITE' ? ' (white)' : '')
}

/** How much of the fade colour covers the picture at `ms` (0…1), for the preview. Nothing outside the clip. */
export function fadeOpacityAt(ms: number, startMs: number, endMs: number, fade: ClipFade | null | undefined): number {
  if (isNoFade(fade) || ms < startMs || ms > endMs) return 0
  const f = fade!
  const fromStart = f.inMs > 0 ? 1 - (ms - startMs) / f.inMs : 0
  const toEnd = f.outMs > 0 ? 1 - (endMs - ms) / f.outMs : 0
  return +Math.min(1, Math.max(0, fromStart, toEnd)).toFixed(3)
}

/** The preview's zoom at `ms` (1…1 + ZOOM_AMOUNT), matching the render: in over the clip, or out from close up. */
export function zoomScaleAt(ms: number, startMs: number, endMs: number, effect: VideoEffect): number {
  if (effect !== 'ZOOM_IN' && effect !== 'ZOOM_OUT') return 1
  const progress = Math.min(1, Math.max(0, (ms - startMs) / Math.max(1, endMs - startMs)))
  return +(1 + ZOOM_AMOUNT * (effect === 'ZOOM_IN' ? progress : 1 - progress)).toFixed(4)
}

/** Extra CSS filter for the preview of an effect that stays the same through the clip ('' for none or one it can't show). */
export function effectCssFilter(effect: VideoEffect): string {
  return effect === 'OLD_FILM' ? 'sepia(0.85) contrast(1.05)' : ''
}
