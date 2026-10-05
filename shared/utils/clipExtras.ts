// More parts of a trim (Trim tab): blurred areas, one part at another speed, a
// video in a corner, and intro/outro cards. The backend renders them
// (VideoEditRules.BlurBox / SpeedRange / Pip / Cards) and re-checks them; these
// mirror its rules for inline errors and disabled states.

// ── Blurred areas ────────────────────────────────────────────────────────────

/** In the original picture's pixels, like the crop (which comes after). */
export interface BlurBox {
  x: number
  y: number
  w: number
  h: number
}

export const MAX_BLURS = 5
export const MIN_BLUR_SIZE = 8

export function validateBlurs(boxes: BlurBox[], videoWidth: number | null, videoHeight: number | null): string | null {
  if (boxes.length > MAX_BLURS) return `At most ${MAX_BLURS} blurred areas`
  for (const [i, b] of boxes.entries()) {
    const at = `Blurred area ${i + 1}: `
    if (b.w < MIN_BLUR_SIZE || b.h < MIN_BLUR_SIZE) return `${at}too small`
    if (b.x < 0 || b.y < 0 || (videoWidth && b.x + b.w > videoWidth) || (videoHeight && b.y + b.h > videoHeight))
      return `${at}it goes past the edge of the picture`
  }
  return null
}

/** A new box a quarter of the picture's size, in the middle. */
export function newBlurBox(videoWidth: number, videoHeight: number): BlurBox {
  const w = Math.max(MIN_BLUR_SIZE, Math.round(videoWidth / 4))
  const h = Math.max(MIN_BLUR_SIZE, Math.round(videoHeight / 4))
  return { x: Math.round((videoWidth - w) / 2), y: Math.round((videoHeight - h) / 2), w, h }
}

// ── One part at another speed ────────────────────────────────────────────────

/** Times on the trimmed clip's timeline (from its start); the sound keeps its pitch. */
export interface SpeedRange {
  startMs: number
  endMs: number
  speed: number
}

export const RAMP_SPEEDS = [0.25, 0.5, 0.75, 1.5, 2, 4]
export const MIN_RAMP_MS = 500

export function validateSpeedRange(r: SpeedRange | null, clipMs: number | null): string | null {
  if (!r) return null
  if (!RAMP_SPEEDS.includes(r.speed)) return 'Pick a speed'
  if (r.startMs < 0 || r.endMs - r.startMs < MIN_RAMP_MS) return `The part must be at least ${MIN_RAMP_MS / 1000} s long`
  if (clipMs != null && r.endMs > clipMs) return 'The part runs past the end of the clip'
  return null
}

/** The clip's new length once the part plays at its speed. */
export function rampedLength(clipMs: number, r: SpeedRange | null): number {
  if (!r) return clipMs
  const part = Math.min(r.endMs, clipMs) - r.startMs
  return Math.round(clipMs - part + part / r.speed)
}

/** "slow motion 0.5× for 2 s" — the same words as the server's summary. */
export function describeSpeedRange(r: SpeedRange | null): string | null {
  if (!r) return null
  return `${r.speed < 1 ? 'slow motion' : 'sped up'} ${r.speed}× for ${+((r.endMs - r.startMs) / 1000).toFixed(1)} s`
}

// ── A video in a corner ──────────────────────────────────────────────────────

export type PipCorner = 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'

export interface PipSettings {
  videoId: number | null
  /** For the preview and the summary only (not sent). */
  title?: string
  thumbnailUrl?: string | null
  corner: PipCorner
  /** Its width as % of the clip's. */
  sizePct: number
}

export const PIP_CORNERS: { value: PipCorner; label: string; icon: string }[] = [
  { value: 'TOP_LEFT', label: 'Top left', icon: 'i-lucide-arrow-up-left' },
  { value: 'TOP_RIGHT', label: 'Top right', icon: 'i-lucide-arrow-up-right' },
  { value: 'BOTTOM_LEFT', label: 'Bottom left', icon: 'i-lucide-arrow-down-left' },
  { value: 'BOTTOM_RIGHT', label: 'Bottom right', icon: 'i-lucide-arrow-down-right' }
]
export const MIN_PIP_PCT = 15
export const MAX_PIP_PCT = 50

export function validatePip(p: PipSettings | null): string | null {
  if (!p) return null
  if (p.videoId == null) return 'Picture in picture: pick a video'
  if (!(p.sizePct >= MIN_PIP_PCT && p.sizePct <= MAX_PIP_PCT)) return `Picture in picture: the size must be between ${MIN_PIP_PCT}% and ${MAX_PIP_PCT}%`
  return null
}

/** The `pip` part of the trim request (without the preview-only fields); null for none. */
export function pipRequest(p: PipSettings | null): { videoId: number; corner: PipCorner; sizePct: number } | null {
  return p && p.videoId != null ? { videoId: p.videoId, corner: p.corner, sizePct: p.sizePct } : null
}

export function describePip(p: PipSettings | null): string | null {
  return p && p.videoId != null ? `picture in picture${p.title ? ` (${p.title})` : ''}` : null
}

// ── Intro and outro cards ────────────────────────────────────────────────────

export interface ClipCard {
  text: string
  durationMs: number
}

export interface ClipCards {
  intro: ClipCard | null
  outro: ClipCard | null
  /** #RRGGBB */
  background: string
  color: string
  /** An uploaded image (an overlay upload) shown above the text; null for none. */
  logoKey: string | null
  /** For the preview only (not sent). */
  logoUrl?: string | null
}

export const MIN_CARD_MS = 1000
export const MAX_CARD_MS = 6000
export const MAX_CARD_TEXT = 120

export function isHexColour(s: string | null | undefined): boolean {
  return !!s && /^#[0-9a-fA-F]{6}$/.test(s)
}

export function validateCards(c: ClipCards | null): string | null {
  if (!c) return null
  if (!c.intro && !c.outro) return 'Add an intro or an outro card'
  for (const [which, card] of [
    ['Intro', c.intro],
    ['Outro', c.outro]
  ] as const) {
    if (!card) continue
    if (!card.text.trim()) return `${which} card: write its text`
    if (card.text.length > MAX_CARD_TEXT) return `${which} card: the text can be at most ${MAX_CARD_TEXT} characters`
    if (!(card.durationMs >= MIN_CARD_MS && card.durationMs <= MAX_CARD_MS))
      return `${which} card: it lasts between ${MIN_CARD_MS / 1000} and ${MAX_CARD_MS / 1000} s`
  }
  if (!isHexColour(c.background) || !isHexColour(c.color)) return 'Cards: pick the colours'
  return null
}

/** The `cards` part of the trim request (without the preview-only logo link); null for none. */
export function cardsRequest(c: ClipCards | null): Omit<ClipCards, 'logoUrl'> | null {
  if (!c || (!c.intro && !c.outro)) return null
  const { logoUrl: _url, ...rest } = c
  return { ...rest, intro: c.intro ? { ...c.intro } : null, outro: c.outro ? { ...c.outro } : null }
}

export function describeCards(c: ClipCards | null): string | null {
  if (!c || (!c.intro && !c.outro)) return null
  return c.intro && c.outro ? 'intro and outro cards' : c.intro ? 'intro card' : 'outro card'
}

/** How much the cards add to the clip's length. */
export function cardsLength(c: ClipCards | null): number {
  return c ? (c.intro?.durationMs ?? 0) + (c.outro?.durationMs ?? 0) : 0
}
