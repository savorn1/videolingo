// Wraps the backend's StreamingAdminController (/api/admin/streaming/**), module "streaming": RuengFlix
// (the public streaming site) as the admin portal manages it. GET = READ; everything else = WRITE
// (hero order, resolve a report, remove a follower, reset votes, send an alert, prices, refresh).
// A series' own settings are edited with its collection (`streaming` in useCollections).

import type { ApiEnvelope } from '#shared/types'
import type { SeriesCategory, SeriesStatus } from '#shared/utils/streamingSeries'

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
}

export type OrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'

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
}

export type CommentFilter = 'reported' | 'hidden' | 'all'

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

  async function dashboard() {
    return (await api<ApiEnvelope<StreamingDashboard>>(`${base}/dashboard`)).data
  }

  async function status() {
    return (await api<ApiEnvelope<StreamingStatus>>(`${base}/status`)).data
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
    dashboard,
    status,
    refreshSite
  }
}
