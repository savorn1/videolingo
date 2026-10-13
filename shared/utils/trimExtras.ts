// More on a trim (the Trim tab's "Blur, picture in picture & cards"): areas blurred for the whole clip, another
// stored video in a corner, and title cards before and after. Mirrors backend VideoEditRules (validateBlurs /
// validatePip / validateCards), which re-checks everything.

export const MAX_BLURS = 5
export const MIN_BLUR_SIZE = 8
export const MIN_PIP_PCT = 15
export const MAX_PIP_PCT = 50
export const MIN_CARD_MS = 1000
export const MAX_CARD_MS = 6000
export const MAX_CARD_TEXT = 120

export const PIP_CORNERS = [
  { value: 'TOP_LEFT', label: 'Top left' },
  { value: 'TOP_RIGHT', label: 'Top right' },
  { value: 'BOTTOM_LEFT', label: 'Bottom left' },
  { value: 'BOTTOM_RIGHT', label: 'Bottom right' }
] as const
export type PipCorner = (typeof PIP_CORNERS)[number]['value']

/** In the original picture's pixels (before the crop), like the crop box. */
export interface BlurBox {
  x: number
  y: number
  w: number
  h: number
}

export interface TitleCard {
  text: string
  durationMs: number
}

export interface TrimExtras {
  blurs: BlurBox[]
  pip: { videoId: number | null; videoTitle: string | null; corner: PipCorner; sizePct: number } | null
  cards: { intro: TitleCard | null; outro: TitleCard | null; background: string; color: string; logoKey: string | null; logoName: string | null } | null
}

export const PLAIN_EXTRAS: TrimExtras = { blurs: [], pip: null, cards: null }

export function isPlainExtras(e: TrimExtras): boolean {
  return !e.blurs.length && !e.pip && !e.cards
}

/** A new blur box: a quarter of the picture, in the middle. */
export function newBlurBox(width: number, height: number): BlurBox {
  const w = Math.max(MIN_BLUR_SIZE, Math.round(width / 4))
  const h = Math.max(MIN_BLUR_SIZE, Math.round(height / 4))
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h }
}

const HEX = /^#[0-9a-f]{6}$/i

/** Why these can't be rendered (as the server will say), or null. Picture size in the original's pixels, 0 = unknown. */
export function extrasProblem(e: TrimExtras, width: number, height: number): string | null {
  if (e.blurs.length > MAX_BLURS) return `At most ${MAX_BLURS} blurred areas`
  for (const [i, b] of e.blurs.entries()) {
    if (b.w < MIN_BLUR_SIZE || b.h < MIN_BLUR_SIZE) return `Blurred area ${i + 1} is too small`
    if (b.x < 0 || b.y < 0 || (width && b.x + b.w > width) || (height && b.y + b.h > height)) return `Blurred area ${i + 1}: it must be inside the picture`
  }
  if (e.pip) {
    if (!e.pip.videoId) return 'Picture in picture: pick a video'
    if (e.pip.sizePct < MIN_PIP_PCT || e.pip.sizePct > MAX_PIP_PCT) return `Picture in picture: the size must be between ${MIN_PIP_PCT}% and ${MAX_PIP_PCT}%`
  }
  if (e.cards) {
    const c = e.cards
    if (!c.intro && !c.outro) return 'Add an intro or an outro card'
    for (const [which, card] of [
      ['Intro', c.intro],
      ['Outro', c.outro]
    ] as const) {
      if (!card) continue
      if (!card.text.trim()) return `${which} card: write its text`
      if (card.text.length > MAX_CARD_TEXT) return `${which} card: the text can be at most ${MAX_CARD_TEXT} characters`
      if (card.durationMs < MIN_CARD_MS || card.durationMs > MAX_CARD_MS) return `${which} card: it lasts between 1 and 6 s`
    }
    if (!HEX.test(c.background) || !HEX.test(c.color)) return 'Cards: pick the colours'
  }
  return null
}

/** The trim request's fields for these; the ones not in use are left out. */
export function extrasRequest(e: TrimExtras) {
  return {
    ...(e.blurs.length ? { blurs: e.blurs.map((b) => ({ ...b })) } : {}),
    ...(e.pip?.videoId ? { pip: { videoId: e.pip.videoId, corner: e.pip.corner, sizePct: e.pip.sizePct } } : {}),
    ...(e.cards
      ? {
          cards: {
            intro: e.cards.intro ? { text: e.cards.intro.text.trim(), durationMs: e.cards.intro.durationMs } : null,
            outro: e.cards.outro ? { text: e.cards.outro.text.trim(), durationMs: e.cards.outro.durationMs } : null,
            background: e.cards.background,
            color: e.cards.color,
            logoKey: e.cards.logoKey
          }
        }
      : {})
  }
}

/** "2 blurred areas, picture in picture, intro card" — for the trim summary; null for none. */
export function describeExtras(e: TrimExtras): string | null {
  const parts: string[] = []
  if (e.blurs.length) parts.push(`${e.blurs.length} blurred area${e.blurs.length === 1 ? '' : 's'}`)
  if (e.pip?.videoId) parts.push('picture in picture')
  if (e.cards) parts.push(e.cards.intro && e.cards.outro ? 'intro and outro cards' : e.cards.intro ? 'intro card' : 'outro card')
  return parts.length ? parts.join(', ') : null
}

/** From a draft saved by any version (missing parts are none). */
export function sanitizeExtras(raw: unknown): TrimExtras {
  const r = raw && typeof raw === 'object' ? (raw as Partial<TrimExtras>) : {}
  return { blurs: Array.isArray(r.blurs) ? r.blurs.map((b) => ({ ...b })) : [], pip: r.pip ? { ...r.pip } : null, cards: r.cards ? { ...r.cards } : null }
}
