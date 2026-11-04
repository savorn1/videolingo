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
    status,
    refreshSite
  }
}
