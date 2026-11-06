// Pure helpers for the RuengFlix pages (app/pages/ruengflix): labels, viewer-data arithmetic, the hero
// order and the prices form. The backend (StreamingAdminService, Settings.Streaming) is the authority.

export const SERIES_STATE_META: Record<'LIVE' | 'NOT_PUBLIC' | 'NO_EPISODES', { label: string; color: 'success' | 'warning' | 'neutral'; icon: string }> = {
  LIVE: { label: 'Live', color: 'success', icon: 'i-lucide-radio' },
  NOT_PUBLIC: { label: 'Hidden: not Public', color: 'warning', icon: 'i-lucide-eye-off' },
  NO_EPISODES: { label: 'No episodes yet', color: 'neutral', icon: 'i-lucide-clock' }
}

export const REPORT_REASON_LABELS: Record<'VIDEO' | 'SUBTITLES' | 'AUDIO' | 'OTHER', string> = {
  VIDEO: 'Video',
  SUBTITLES: 'Subtitles',
  AUDIO: 'Audio',
  OTHER: 'Other'
}

/** Share of plays that reached the end (90 %), as a whole percent; null with no plays. */
export function finishPercent(starts: number, completes: number): number | null {
  if (!starts) return null
  return Math.min(100, Math.round((completes / starts) * 100))
}

/** Share of votes that were 👍, as a whole percent; null with no votes. */
export function likePercent(likes: number, dislikes: number): number | null {
  const total = likes + dislikes
  return total ? Math.round((likes / total) * 100) : null
}

/**
 * For each episode but the last: of the plays that finished it, the share that went on to start the
 * next one (whole percent, capped at 100; null when nobody finished it). Index i is episode i + 1.
 */
export function continuePercents(episodes: { starts: number; completes: number }[]): (number | null)[] {
  return episodes.slice(0, -1).map((e, i) => {
    if (!e.completes) return null
    return Math.min(100, Math.round((episodes[i + 1]!.starts / e.completes) * 100))
  })
}

/** The episode number after which the most viewers stop (lowest continue %), or null. */
export function biggestDropOff(episodes: { starts: number; completes: number }[]): number | null {
  const rates = continuePercents(episodes)
  let worst: number | null = null
  rates.forEach((r, i) => {
    if (r != null && (worst == null || r < rates[worst - 1]!)) worst = i + 1
  })
  return worst
}

/** Links to a series and an episode on RuengFlix; null when its address isn't configured. */
export function ruengflixUrl(siteUrl: string, seriesId: number, episode?: number): string | null {
  const site = siteUrl.trim().replace(/\/+$/, '')
  if (!site) return null
  return episode ? `${site}/watch/${seriesId}/${episode}` : `${site}/detail/${seriesId}`
}

/** "1:05" for 65 seconds; "1:01:05" past an hour. */
export function playerTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export const PRICE_FIELDS = [
  { key: 'seriesUnlockPrice', label: 'Unlock one series', hint: 'paid once, every episode of that series' },
  { key: 'vip1Month', label: 'VIP · 1 month', hint: 'every VIP series' },
  { key: 'vip3Months', label: 'VIP · 3 months', hint: 'shown as the popular plan' },
  { key: 'vip6Months', label: 'VIP · 6 months', hint: '' },
  { key: 'vip12Months', label: 'VIP · 12 months', hint: 'shown as the best value' }
] as const

export type PriceKey = (typeof PRICE_FIELDS)[number]['key']

/** Problems with the prices form (the backend allows 0–1000 dollars). */
export function priceProblems(values: Record<PriceKey, number | null | undefined>): string[] {
  const problems: string[] = []
  for (const f of PRICE_FIELDS) {
    const v = values[f.key]
    if (v == null || !Number.isFinite(v)) problems.push(`${f.label}: enter a price.`)
    else if (v < 0 || v > 1000) problems.push(`${f.label}: must be from $0 to $1,000.`)
    else if (Math.round(v * 100) !== Math.round(v * 1000) / 10) problems.push(`${f.label}: use at most two decimals.`)
  }
  const per = (key: PriceKey, months: number) => (values[key] ?? 0) / months
  if (!problems.length && per('vip12Months', 12) > per('vip1Month', 1)) {
    problems.push('The 12-month plan costs more per month than the 1-month plan.')
  }
  return problems
}

/** Coin settings (all optional: an empty one uses RuengFlix's default). Packs in dollars, the rest in coins. */
export const COIN_PACK_FIELDS = [
  { key: 'coinPack100', label: '100 coins', hint: 'bought with KHQR' },
  { key: 'coinPack300', label: '300 coins', hint: '' },
  { key: 'coinPack1000', label: '1,000 coins', hint: '' }
] as const

export const COIN_FIELDS = [
  { key: 'episodeUnlockCoins', label: 'Unlock one VIP episode', hint: 'coins', min: 1, max: 10000 },
  { key: 'dailyCheckInCoins', label: 'Daily check-in', hint: 'coins; the 7th day in a row pays double', min: 1, max: 1000 },
  { key: 'firstTopUpBonusPercent', label: 'First top-up bonus', hint: "% extra coins on a viewer's first pack; 0 = off", min: 0, max: 200 },
  { key: 'previewSeconds', label: 'Free preview', hint: 'seconds of the first VIP episode before paying; 0 = off', min: 0, max: 180 },
  { key: 'adUnlocksPerDay', label: 'Ad unlocks a day', hint: 'VIP episodes a viewer may unlock daily by watching a sponsor ad; 0 = off', min: 0, max: 20 }
] as const

export type CoinPackKey = (typeof COIN_PACK_FIELDS)[number]['key']
export type CoinKey = (typeof COIN_FIELDS)[number]['key']

/** Problems with the coin settings (the backend allows packs $0.01–$1,000 and whole coin amounts). */
export function coinProblems(values: Record<CoinPackKey | CoinKey, number | null | undefined>): string[] {
  const problems: string[] = []
  for (const f of COIN_PACK_FIELDS) {
    const v = values[f.key]
    if (v == null) continue
    if (!Number.isFinite(v) || v < 0.01 || v > 1000) problems.push(`${f.label}: must be from $0.01 to $1,000.`)
    else if (Math.round(v * 100) !== Math.round(v * 1000) / 10) problems.push(`${f.label}: use at most two decimals.`)
  }
  for (const f of COIN_FIELDS) {
    const v = values[f.key]
    if (v == null) continue
    if (!Number.isInteger(v) || v < f.min || v > f.max) problems.push(`${f.label}: a whole number from ${f.min} to ${f.max.toLocaleString('en-US')}.`)
  }
  return problems
}

export const ORDER_STATUS_META: Record<
  'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED',
  { label: string; color: 'warning' | 'success' | 'neutral' | 'error' | 'info' }
> = {
  PENDING: { label: 'Waiting', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  EXPIRED: { label: 'Expired', color: 'neutral' },
  CANCELLED: { label: 'Cancelled', color: 'error' },
  REFUNDED: { label: 'Refunded', color: 'info' }
}

/** Coin history reasons, as admins read them */
export const LEDGER_REASONS: Record<string, string> = {
  PURCHASE: 'Bought (KHQR)',
  BONUS: 'First top-up bonus',
  CHECK_IN: 'Daily check-in',
  UNLOCK: 'Unlocked an episode',
  MISSION: 'Daily mission',
  INVITE: 'Invite reward',
  REFUND: 'Refund (taken back)',
  ADMIN: 'Given by an admin'
}

/** Problems with an admin's coin adjustment: a whole number from -10,000 to 10,000, not 0, and a reason */
export function coinGrantProblems(coins: number | null | undefined, reason: string): string[] {
  const problems: string[] = []
  if (coins == null || !Number.isInteger(coins) || coins === 0 || Math.abs(coins) > 10000) {
    problems.push('Coins: a whole number from -10,000 to 10,000, not 0.')
  }
  const r = reason.trim()
  if (r.length < 3 || r.length > 200) problems.push('Reason: 3 to 200 characters.')
  return problems
}

/**
 * What an order bought: "300 coins" (+ "+150 bonus" on a first top-up, "+90 promo" during a promotion),
 * "VIP · 3 months", "Series: Summer love"; "Gift: …" when bought for someone else.
 */
export function orderProduct(o: {
  kind: string
  coins: number | null
  months: number | null
  seriesTitle: string | null
  bonusCoins?: number | null
  promoCoins?: number | null
  gift?: boolean
}): string {
  const what =
    o.kind === 'COINS'
      ? `${(o.coins ?? 0).toLocaleString('en-US')} coins${o.bonusCoins ? ` +${o.bonusCoins.toLocaleString('en-US')} bonus` : ''}${
          o.promoCoins ? ` +${o.promoCoins.toLocaleString('en-US')} promo` : ''
        }`
      : o.kind === 'VIP'
        ? `VIP · ${o.months ?? 0} month${o.months === 1 ? '' : 's'}`
        : `Series: ${o.seriesTitle ?? 'deleted'}`
  return o.gift ? `Gift: ${what}` : what
}

/** A retention rate as a whole percent, or "—" when nobody is in the cohort yet */
export function retentionLabel(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}
