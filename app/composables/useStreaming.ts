// Wraps the backend's StreamingAdminController (/api/admin/streaming/**), module "streaming": RuengFlix
// (the public streaming site) as the admin portal manages it. GET = READ; everything else = WRITE
// (hero order, resolve a report, remove a follower, reset votes, send an alert, prices, refresh).
// A series' own settings are edited with its collection (`streaming` in useCollections).

import type { ApiEnvelope } from '#shared/types'
import type { SeriesCategory, SeriesStatus } from '#shared/utils/streamingSeries'
import type { HomeRowSource } from '#shared/utils/homeRows'

export type SeriesState = 'LIVE' | 'NOT_PUBLIC' | 'NO_EPISODES'

export interface SeriesProblem {
  level: 'ERROR' | 'WARNING'
  message: string
}

export interface ViewerTotals {
  starts: number
  completes: number
  likes: number
  dislikes: number
}

export interface StreamingSeriesSummary {
  id: number
  slug: string
  title: string
  coverUrl: string | null
  visibility: string
  category: SeriesCategory | null
  status: SeriesStatus | null
  vip: boolean
  freeEpisodes: number
  featuredRank: number | null
  /** Released episodes */
  episodes: number
  scheduled: number
  nextEpisodeAt: string | null
  totals: ViewerTotals
  followers: number
  openReports: number
  lastAlert: { episode: number; source: AlertSource; sent: number; at: string } | null
  state: SeriesState
  problems: SeriesProblem[]
}

export interface StreamingOverview {
  /** RuengFlix's public address (RUENGFLIX_URL); '' when not set */
  siteUrl: string
  /** Alerts and refresh need RUENGFLIX_URL and RUENGFLIX_NOTIFY_SECRET on the server */
  siteConnected: boolean
  series: StreamingSeriesSummary[]
}

export interface StreamingEpisode extends ViewerTotals {
  number: number
  videoId: number
  title: string
  durationSeconds: number | null
  subtitled: boolean
  /** Has a Khmer voice-over track (made or uploaded), offered on RuengFlix as "Khmer voice" */
  dubbed: boolean
  locked: boolean
}

export interface StreamingSeriesDetail {
  siteUrl: string
  siteConnected: boolean
  series: StreamingSeriesSummary
  episodes: StreamingEpisode[]
}

export type ReportReason = 'VIDEO' | 'SUBTITLES' | 'AUDIO' | 'OTHER'

export interface ViewerReport {
  id: number
  seriesId: number
  seriesTitle: string
  episode: number
  reason: ReportReason
  note: string
  positionSeconds: number
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

export interface SeriesFollower {
  chatId: number
  since: string
}

export type AlertSource = 'AUTO' | 'MANUAL'

export interface AlertLogEntry {
  id: number
  episode: number
  source: AlertSource
  followers: number
  sent: number
  removed: number
  failed: number
  at: string
}

export interface AlertResult {
  episode: number
  followers?: number
  sent?: number
  removed?: number
  failed?: number
}

/** Settings.Streaming on the backend: prices in US dollars */
export interface StreamingPrices {
  seriesUnlockPrice: number
  vip1Month: number
  vip3Months: number
  vip6Months: number
  vip12Months: number
  /** Coin settings: null uses RuengFlix's default */
  coinPack100: number | null
  coinPack300: number | null
  coinPack1000: number | null
  episodeUnlockCoins: number | null
  dailyCheckInCoins: number | null
  /** Extra coins (percent) on a viewer's first coin pack; 0 turns it off, null uses the default */
  firstTopUpBonusPercent: number | null
  /** Seconds of the first VIP episode viewers may watch before paying; 0 turns previews off */
  previewSeconds: number | null
  /** VIP episodes a viewer may unlock a day by watching a sponsor ad; 0 turns ad unlocks off */
  adUnlocksPerDay: number | null
}

/** A sponsor video viewers watch to unlock one VIP episode */
export interface StreamingAd {
  id: number
  title: string
  videoUrl: string
  clickUrl: string | null
  seconds: number
  active: boolean
  weight: number
  /** Times shown, and watched to the end (each one unlocked an episode) */
  started: number
  completed: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type AdInput = Partial<Pick<StreamingAd, 'title' | 'videoUrl' | 'clickUrl' | 'seconds' | 'active' | 'weight'>>

/** A row of series on RuengFlix's home page, in `position` order (backend StreamingHomeRowsService) */
export interface StreamingHomeRow {
  id: number
  title: string
  source: HomeRowSource
  /** The category (CATEGORY) or genre (GENRE); null otherwise */
  value: string | null
  maxItems: number
  position: number
  active: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type HomeRowInput = Partial<Pick<StreamingHomeRow, 'title' | 'source' | 'value' | 'maxItems' | 'active'>>

export type PromotionKind = 'FREE_SERIES' | 'COIN_BONUS'

export interface StreamingPromotion {
  id: number
  kind: PromotionKind
  title: string
  seriesId: number | null
  seriesTitle: string | null
  bonusPercent: number | null
  /** Database wall-clock times (the server's time zone), like every RuengFlix time */
  startsAt: string
  endsAt: string
  state: 'SCHEDULED' | 'RUNNING' | 'ENDED'
  createdBy: string | null
  createdAt: string
}

export interface PromotionInput {
  kind: PromotionKind
  title: string
  seriesId?: number | null
  bonusPercent?: number | null
  /** "YYYY-MM-DDTHH:mm" local times */
  startsAt: string
  endsAt: string
}

export interface StreamingClip {
  id: number
  code: string
  seriesId: number
  seriesTitle: string
  episode: number
  startSeconds: number
  seconds: number
  status: 'PENDING' | 'WORKING' | 'READY' | 'FAILED'
  url: string | null
  posterUrl: string | null
  error: string | null
  views: number
  viewerName: string | null
  createdAt: string
}

export interface FunnelEpisode {
  episode: number
  /** After the free episodes of a VIP series */
  premium: boolean
  starts: number
  completes: number
  /** Times the unlock screen was shown */
  wallViews: number
  coinUnlocks: number
  adUnlocks: number
  adsStarted: number
}

export interface SeriesFunnel {
  seriesId: number
  title: string
  vip: boolean
  freeEpisodes: number
  episodes: FunnelEpisode[]
  seriesPurchases: number
  seriesRevenueUsd: number
  coinsSpent: number
}

export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED'

/** A RuengFlix KHQR payment (coins, a series or VIP time) */
export interface StreamingOrder {
  id: number
  viewerId: number | null
  viewerName: string | null
  kind: 'COINS' | 'SERIES' | 'VIP'
  amountUsd: number
  coins: number | null
  seriesId: number | null
  seriesTitle: string | null
  months: number | null
  status: OrderStatus
  billNumber: string
  createdAt: string
  expiresAt: string
  paidAt: string | null
  /** "bakong" (confirmed by the bank) or the admin who confirmed it */
  paidBy: string | null
  bakongHash: string | null
  note: string | null
  /** First top-up bonus added on top of a coin pack */
  bonusCoins: number | null
  refundedAt: string | null
  refundedBy: string | null
  refundReason: string | null
  /** Extra coins from a running promotion */
  promoCoins: number | null
  /** Bought for someone else: its code once paid, and who redeemed it */
  gift: boolean
  giftCode: string | null
  giftRedeemedByName: string | null
  giftRedeemedAt: string | null
}

/** A viewer's money, for support: wallet, orders, unlocks, coin history and invites */
export interface ViewerMoney {
  viewer: {
    id: number
    displayName: string
    phone: string | null
    telegramUsername: string | null
    telegramLinked: boolean
    googleEmail: string | null
    disabled: boolean
    createdAt: string
    lastLoginAt: string | null
  }
  wallet: { coins: number; vipUntil: string | null; vipActive: boolean }
  orders: StreamingOrder[]
  unlocks: { seriesId: number; seriesTitle: string | null; episode: number; source: string; createdAt: string }[]
  ledger: { id: number; delta: number; reason: string; ref: string | null; createdAt: string }[]
  invites: { code: string | null; invitedByName: string | null; invitedById: number | null; joined: number; rewarded: number }
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface StreamingComment {
  id: number
  seriesId: number
  seriesTitle: string
  episode: number
  viewerId: number
  viewerName: string
  body: string
  reportCount: number
  createdAt: string
  hiddenAt: string | null
  hiddenBy: string | null
  likeCount: number
  /** Pinned to the top of its episode (one per episode) */
  pinnedAt: string | null
  pinnedBy: string | null
  /** The official reply under it, if any */
  replyId: number | null
  replyBody: string | null
  replyBy: string | null
}

export type CommentFilter = 'reported' | 'hidden' | 'pinned' | 'all'

/** What waits for an admin, for the menu badges */
export interface StreamingBadges {
  pendingOrders: number
  reportedComments: number
}

export interface StreamingDashboard {
  revenue7Days: number
  revenue30Days: number
  pendingOrders: number
  revenueByDay: { day: string; amountUsd: number; orders: number }[]
  revenueByKind: { kind: 'COINS' | 'SERIES' | 'VIP'; amountUsd: number; orders: number }[]
  topSeries: { seriesId: number; title: string; amountUsd: number; orders: number }[]
  coinsHeld: number
  coinsSpent30Days: number
  vipActive: number
  viewers: number
  newViewers7Days: number
  activeToday: number
  active7Days: number
  retention: { day: number; cohort: number; returned: number; rate: number | null }[]
}

export interface PricesView {
  section: string
  values: StreamingPrices
  defaults: StreamingPrices
  customized: boolean
  version: number | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface ServiceCheck {
  name: string
  configured: boolean
  ok: boolean
  detail: string
  millis: number | null
}

export interface StreamingStatus {
  siteUrl: string
  checks: ServiceCheck[]
}

/** A RuengFlix viewer account, created on the site with a phone + password, Telegram or Google */
export interface ViewerAccount {
  id: number
  /** "012 345 678"; null for accounts made with Telegram or Google */
  phone: string | null
  telegramLinked: boolean
  telegramUsername: string | null
  googleEmail: string | null
  displayName: string
  disabled: boolean
  createdAt: string
  lastLoginAt: string | null
  /** When their library (saved series, history, unlocks) was last synced; null before the first sync */
  librarySyncedAt: string | null
}

export interface ViewerAccountPage {
  items: ViewerAccount[]
  total: number
  page: number
  size: number
}

export type ViewerStatusFilter = 'all' | 'active' | 'disabled'

export function useStreaming() {
  const api = useApi()
  const base = '/api/admin/streaming'

  async function overview() {
    return (await api<ApiEnvelope<StreamingOverview>>(`${base}/series`)).data
  }

  async function detail(id: number) {
    return (await api<ApiEnvelope<StreamingSeriesDetail>>(`${base}/series/${id}`)).data
  }

  async function saveFeatured(collectionIds: number[]) {
    return (await api<ApiEnvelope<StreamingOverview>>(`${base}/featured`, { method: 'PUT', body: { collectionIds } })).data
  }

  async function resetVotes(id: number, episode?: number) {
    return (await api<ApiEnvelope<number>>(`${base}/series/${id}/votes/reset`, { method: 'POST', body: { episode } })).data
  }

  async function followers(id: number) {
    return (await api<ApiEnvelope<SeriesFollower[]>>(`${base}/series/${id}/followers`)).data
  }

  async function removeFollower(id: number, chatId: number) {
    await api(`${base}/series/${id}/followers/${chatId}`, { method: 'DELETE' })
  }

  async function alerts(id: number) {
    return (await api<ApiEnvelope<AlertLogEntry[]>>(`${base}/series/${id}/alerts`)).data
  }

  async function sendAlert(id: number, episode?: number) {
    return (await api<ApiEnvelope<AlertResult>>(`${base}/series/${id}/alerts`, { method: 'POST', body: { episode } })).data
  }

  async function reports(opts: { includeResolved?: boolean; seriesId?: number } = {}) {
    return (await api<ApiEnvelope<ViewerReport[]>>(`${base}/reports`, { query: opts })).data
  }

  async function resolveReport(id: number, resolved: boolean) {
    return (await api<ApiEnvelope<ViewerReport>>(`${base}/reports/${id}`, { method: 'PUT', body: { resolved } })).data
  }

  async function prices() {
    return (await api<ApiEnvelope<PricesView>>(`${base}/prices`)).data
  }

  async function savePrices(values: StreamingPrices, version: number | null) {
    return (await api<ApiEnvelope<PricesView>>(`${base}/prices`, { method: 'PUT', body: values, query: { version: version ?? -1 } })).data
  }

  async function viewers(opts: { q?: string; status?: ViewerStatusFilter; page?: number; size?: number } = {}) {
    return (await api<ApiEnvelope<ViewerAccountPage>>(`${base}/viewers`, { query: opts })).data
  }

  /** Disabling also signs the viewer out of RuengFlix on every device */
  async function setViewerDisabled(id: number, disabled: boolean) {
    return (await api<ApiEnvelope<ViewerAccount>>(`${base}/viewers/${id}`, { method: 'PUT', body: { disabled } })).data
  }

  async function orders(opts: { status?: OrderStatus | 'all'; q?: string; page?: number; size?: number } = {}) {
    return (await api<ApiEnvelope<Paged<StreamingOrder>>>(`${base}/orders`, { query: opts })).data
  }

  /** Confirm a payment checked in the bank app: RuengFlix delivers the coins, series or VIP time */
  async function markOrderPaid(id: number) {
    return (await api<ApiEnvelope<StreamingOrder>>(`${base}/orders/${id}/paid`, { method: 'POST' })).data
  }

  async function cancelOrder(id: number) {
    return (await api<ApiEnvelope<StreamingOrder>>(`${base}/orders/${id}/cancel`, { method: 'POST' })).data
  }

  async function comments(opts: { filter?: CommentFilter; page?: number; size?: number } = {}) {
    return (await api<ApiEnvelope<Paged<StreamingComment>>>(`${base}/comments`, { query: opts })).data
  }

  /** Showing a comment again also clears its reports */
  async function setCommentHidden(id: number, hidden: boolean) {
    return (await api<ApiEnvelope<StreamingComment>>(`${base}/comments/${id}`, { method: 'PUT', body: { hidden } })).data
  }

  /** Pin a comment to the top of its episode (replacing the one pinned there), or unpin it */
  async function setCommentPinned(id: number, pinned: boolean) {
    return (await api<ApiEnvelope<StreamingComment>>(`${base}/comments/${id}`, { method: 'PUT', body: { pinned } })).data
  }

  /** Answer as RuengFlix (replaces an earlier official reply) */
  async function replyToComment(id: number, body: string) {
    return (await api<ApiEnvelope<StreamingComment>>(`${base}/comments/${id}/reply`, { method: 'POST', body: { body } })).data
  }

  async function deleteReply(id: number) {
    return (await api<ApiEnvelope<StreamingComment>>(`${base}/comments/${id}/reply`, { method: 'DELETE' })).data
  }

  /** Refund a paid order (APPROVE): what it delivered is taken back; return the money in the bank app */
  async function refundOrder(id: number, reason: string) {
    return (await api<ApiEnvelope<StreamingOrder>>(`${base}/orders/${id}/reverse`, { method: 'POST', body: { reason } })).data
  }

  async function viewerMoney(viewerId: number) {
    return (await api<ApiEnvelope<ViewerMoney>>(`${base}/viewers/${viewerId}/account`)).data
  }

  /** Give coins (negative takes them back, never below 0) */
  async function grantCoins(viewerId: number, coins: number, reason: string) {
    return (await api<ApiEnvelope<ViewerMoney>>(`${base}/viewers/${viewerId}/coins`, { method: 'POST', body: { coins, reason } })).data
  }

  async function badges() {
    return (await api<ApiEnvelope<StreamingBadges>>(`${base}/badges`)).data
  }

  async function dashboard() {
    return (await api<ApiEnvelope<StreamingDashboard>>(`${base}/dashboard`)).data
  }

  async function status() {
    return (await api<ApiEnvelope<StreamingStatus>>(`${base}/status`)).data
  }

  async function ads() {
    return (await api<ApiEnvelope<StreamingAd[]>>(`${base}/ads`)).data
  }

  async function createAd(body: AdInput) {
    return (await api<ApiEnvelope<StreamingAd>>(`${base}/ads`, { method: 'POST', body })).data
  }

  async function updateAd(id: number, body: AdInput) {
    return (await api<ApiEnvelope<StreamingAd>>(`${base}/ads/${id}`, { method: 'PUT', body })).data
  }

  async function deleteAd(id: number) {
    await api(`${base}/ads/${id}`, { method: 'DELETE' })
  }

  async function homeRows() {
    return (await api<ApiEnvelope<StreamingHomeRow[]>>(`${base}/home-rows`)).data
  }

  async function createHomeRow(body: HomeRowInput) {
    return (await api<ApiEnvelope<StreamingHomeRow>>(`${base}/home-rows`, { method: 'POST', body })).data
  }

  async function updateHomeRow(id: number, body: HomeRowInput) {
    return (await api<ApiEnvelope<StreamingHomeRow>>(`${base}/home-rows/${id}`, { method: 'PUT', body })).data
  }

  async function deleteHomeRow(id: number) {
    await api(`${base}/home-rows/${id}`, { method: 'DELETE' })
  }

  async function orderHomeRows(ids: number[]) {
    return (await api<ApiEnvelope<StreamingHomeRow[]>>(`${base}/home-rows/order`, { method: 'PUT', body: { ids } })).data
  }

  async function promotions() {
    return (await api<ApiEnvelope<StreamingPromotion[]>>(`${base}/promotions`)).data
  }

  async function createPromotion(body: PromotionInput) {
    return (await api<ApiEnvelope<StreamingPromotion>>(`${base}/promotions`, { method: 'POST', body })).data
  }

  /** Ends a running promotion now; removes a scheduled or finished one */
  async function stopPromotion(id: number) {
    await api(`${base}/promotions/${id}`, { method: 'DELETE' })
  }

  async function clips() {
    return (await api<ApiEnvelope<StreamingClip[]>>(`${base}/clips`)).data
  }

  async function deleteClip(id: number) {
    await api(`${base}/clips/${id}`, { method: 'DELETE' })
  }

  async function funnel(seriesId: number) {
    return (await api<ApiEnvelope<SeriesFunnel>>(`${base}/series/${seriesId}/funnel`)).data
  }

  async function refreshSite() {
    return (await api<ApiEnvelope<{ refreshed?: boolean; series?: number | null }>>(`${base}/refresh`, { method: 'POST' })).data
  }

  return {
    overview,
    detail,
    saveFeatured,
    resetVotes,
    followers,
    removeFollower,
    alerts,
    sendAlert,
    reports,
    resolveReport,
    prices,
    savePrices,
    viewers,
    setViewerDisabled,
    orders,
    markOrderPaid,
    cancelOrder,
    comments,
    setCommentHidden,
    setCommentPinned,
    replyToComment,
    deleteReply,
    refundOrder,
    viewerMoney,
    grantCoins,
    badges,
    dashboard,
    status,
    refreshSite,
    ads,
    createAd,
    updateAd,
    deleteAd,
    homeRows,
    createHomeRow,
    updateHomeRow,
    deleteHomeRow,
    orderHomeRows,
    promotions,
    createPromotion,
    stopPromotion,
    clips,
    deleteClip,
    funnel
  }
}
