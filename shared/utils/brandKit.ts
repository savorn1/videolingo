// A brand kit: the logo, the cards' colours and words, and the progress bar colour, saved once in this browser
// and put on any video in one go. The logo is kept as the picture itself (a data URL), not an upload key — edit
// uploads are deleted after a few days — and is uploaded again each time the kit is used. Pure, so tested.
import type { TrimExtras } from './trimExtras'
import { MAX_CARD_TEXT } from './trimExtras'

export const BRAND_KIT_KEY = 'videolingo:brand-kit'
/** The largest logo kept (as a data URL), so it fits in the browser's storage. */
export const MAX_LOGO_DATA = 400_000

export interface BrandKit {
  logo: { dataUrl: string; name: string } | null
  cardBackground: string
  cardColor: string
  introText: string
  outroText: string
  progressBar: string | null
}

const HEX = /^#[0-9a-f]{6}$/i
const IMAGE_DATA = /^data:image\/(png|jpeg|webp);base64,/

/** A brand kit read back from storage, or null when there is none (or it is unusable). */
export function sanitizeBrandKit(raw: unknown): BrandKit | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<BrandKit>
  const logo =
    r.logo && typeof r.logo.dataUrl === 'string' && IMAGE_DATA.test(r.logo.dataUrl) && r.logo.dataUrl.length <= MAX_LOGO_DATA
      ? { dataUrl: r.logo.dataUrl, name: String(r.logo.name ?? 'logo').slice(0, 100) }
      : null
  const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_CARD_TEXT) : '')
  return {
    logo,
    cardBackground: typeof r.cardBackground === 'string' && HEX.test(r.cardBackground) ? r.cardBackground : '#111827',
    cardColor: typeof r.cardColor === 'string' && HEX.test(r.cardColor) ? r.cardColor : '#ffffff',
    introText: text(r.introText),
    outroText: text(r.outroText),
    progressBar: typeof r.progressBar === 'string' && HEX.test(r.progressBar) ? r.progressBar : null
  }
}

/** A kit from the trim's current cards and progress bar, keeping `logo` (the picture, chosen separately). */
export function brandKitFrom(extras: TrimExtras, logo: BrandKit['logo']): BrandKit {
  return {
    logo,
    cardBackground: extras.cards?.background ?? '#111827',
    cardColor: extras.cards?.color ?? '#ffffff',
    introText: extras.cards?.intro?.text ?? '',
    outroText: extras.cards?.outro?.text ?? '',
    progressBar: extras.progressBar
  }
}

/** The trim's cards with the kit's colours, words (where it has them) and logo; cards the kit has no words for stay as they are. */
export function cardsFromKit(kit: BrandKit, current: TrimExtras['cards'], logo: { key: string; name: string } | null): NonNullable<TrimExtras['cards']> {
  const card = (text: string, was: { text: string; durationMs: number } | null | undefined) =>
    text.trim() ? { text: text.trim(), durationMs: was?.durationMs ?? 3000 } : (was ?? null)
  return {
    intro: card(kit.introText, current?.intro),
    outro: card(kit.outroText, current?.outro),
    background: kit.cardBackground,
    color: kit.cardColor,
    logoKey: logo?.key ?? current?.logoKey ?? null,
    logoName: logo?.name ?? current?.logoName ?? null
  }
}

/** "logo, cards, progress bar" — what a kit holds; empty for an empty one. */
export function describeBrandKit(kit: BrandKit): string {
  return [kit.logo ? 'logo' : '', kit.introText || kit.outroText ? 'card words' : '', 'card colours', kit.progressBar ? 'progress bar' : '']
    .filter(Boolean)
    .join(', ')
}
