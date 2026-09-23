// Wraps the backend's AnalyticsController (/api/admin/analytics/*, module
// "analytics", read-only). Every call takes an inclusive ISO date range
// (default: last 30 days) and returns period figures alongside the
// equally long previous period.

import type { Ref } from 'vue'
import type { ApiEnvelope } from '#shared/types'

export interface AnalyticsRange {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  days: number
}

export interface Delta {
  current: number
  previous: number
}

export interface DayValue {
  date: string
  value: number
}

export interface Share {
  key: string
  label: string
  count: number
}

export interface Amount {
  key: string
  label: string
  value: number
  count: number
}

export interface TopVideo {
  videoId: number
  title: string
  views: number
  uniqueViewers: number
  watchSeconds: number
  /** 0–1 */
  completionRate: number
}

export interface UserAnalytics {
  range: AnalyticsRange
  totalUsers: number
  enabledUsers: number
  disabledUsers: number
  admins: number
  neverSignedIn: number
  newUsers: Delta
  activeViewers: Delta
  signedInDuringPeriod: number
  newUsersDaily: DayValue[]
  activeViewersDaily: DayValue[]
  byRole: Share[]
  byCustomRole: Share[]
  topViewers: { userId: number; username: string; views: number; watchSeconds: number; completed: number }[]
}

export interface VideoAnalytics {
  range: AnalyticsRange
  totalVideos: number
  enabledVideos: number
  disabledVideos: number
  trashedVideos: number
  uploads: Delta
  totalDurationSeconds: number
  averageDurationSeconds: number
  withoutTranscript: number
  withoutSubtitles: number
  withoutCategory: number
  neverWatched: number
  uploadsDaily: DayValue[]
  byLanguage: Share[]
  byCategory: Share[]
  byDuration: Share[]
  topVideos: TopVideo[]
}

export interface WatchAnalytics {
  range: AnalyticsRange
  views: Delta
  watchSeconds: Delta
  uniqueViewers: Delta
  completionRate: Delta
  anonymousViews: number
  averageWatchSeconds: number
  averagePercentWatched: number | null
  viewsDaily: DayValue[]
  watchSecondsDaily: DayValue[]
  byHour: Share[]
  byWeekday: Share[]
  /** value = watch seconds, count = views */
  byLanguage: Amount[]
  topVideos: TopVideo[]
}

export interface TranslationAnalytics {
  range: AnalyticsRange
  translations: number
  newTranslations: Delta
  videosTranslated: number
  videosWithTranscript: number
  liveVideos: number
  averageTranslationsPerVideo: number
  translatedWords: number
  translatedSubtitleTracks: number
  jobsByStatus: Share[]
  jobSuccessRate: number | null
  averageJobSeconds: number | null
  translationsDaily: DayValue[]
  byTargetLanguage: Share[]
  bySource: Share[]
  topPairs: { from: string; to: string; count: number }[]
  coverage: Share[]
}

export interface LanguageRow {
  code: string
  name: string
  inCatalog: boolean
  enabled: boolean
  isDefault: boolean
  videos: number
  transcripts: number
  translationsInto: number
  subtitleTracks: number
  publishedSubtitles: number
  views: number
  watchSeconds: number
  aiGenerations: number
}

export interface LanguageAnalytics {
  range: AnalyticsRange
  catalogLanguages: number
  enabledLanguages: number
  languagesInUse: number
  unknownCodes: number
  languages: LanguageRow[]
}

export interface StorageAnalytics {
  range: AnalyticsRange
  storedBytes: number
  storedVideos: number
  externalVideos: number
  unknownSizeVideos: number
  trashedBytes: number
  trashedVideos: number
  averageFileBytes: number
  uploadedBytes: Delta
  uploadedBytesDaily: DayValue[]
  storedBytesDaily: DayValue[]
  byMimeType: Amount[]
  byLanguage: Amount[]
  byOwner: Amount[]
  largest: { videoId: number; title: string; bytes: number; mimeType: string | null; trashed: boolean }[]
  transcriptSegments: number
  subtitleCues: number
  /** Settings › Storage quota; null = none. */
  quotaBytes: number | null
}

export interface AiAnalytics {
  range: AnalyticsRange
  requests: Delta
  costUsd: Delta
  successRate: number | null
  generations: Delta
  chats: Delta
  chatMessages: number
  averageMessagesPerChat: number
  videosWithAi: number
  requestsDaily: DayValue[]
  costDaily: DayValue[]
  byFeature: {
    feature: string
    requests: number
    succeeded: number
    refused: number
    truncated: number
    errors: number
    averageLatencyMs: number | null
    averageTokens: number
    costUsd: number
  }[]
  generationsByType: Share[]
  generationsByLanguage: Share[]
  topVideos: { videoId: number; title: string | null; requests: number; generations: number; chats: number; costUsd: number }[]
}

export interface AnalyticsByArea {
  users: UserAnalytics
  videos: VideoAnalytics
  watch: WatchAnalytics
  translations: TranslationAnalytics
  languages: LanguageAnalytics
  storage: StorageAnalytics
  ai: AiAnalytics
}

export type AnalyticsArea = keyof AnalyticsByArea

export function useAnalytics() {
  const api = useApi()

  async function get<A extends AnalyticsArea>(area: A, from?: string, to?: string) {
    return (await api<ApiEnvelope<AnalyticsByArea[A]>>(`/api/admin/analytics/${area}`, { query: { from, to } })).data
  }

  return { get }
}

/** Loads one area for a reactive range; reloads when it changes, ignoring stale replies. */
export function useAnalyticsArea<A extends AnalyticsArea>(area: A, range: Ref<{ from: string; to: string }>) {
  const { get } = useAnalytics()
  const data = ref<AnalyticsByArea[A] | null>(null) as Ref<AnalyticsByArea[A] | null>
  const loading = ref(true)
  const error = ref('')
  let seq = 0

  async function load() {
    const mine = ++seq
    loading.value = true
    error.value = ''
    try {
      const result = await get(area, range.value.from, range.value.to)
      if (mine === seq) data.value = result
    } catch (err) {
      if (mine === seq) error.value = apiErrorMessage(err)
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  watch(range, load, { deep: true })
  onMounted(load)
  return { data, loading, error, reload: load }
}
