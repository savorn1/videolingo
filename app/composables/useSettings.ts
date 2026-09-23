// Wraps the backend's SettingsController (/api/admin/settings/**, module
// "settings": GET = READ, PUT/DELETE = WRITE) and the non-sensitive client
// settings every signed-in account can read (/api/settings/client).

import type { ApiEnvelope } from '#shared/types'
import type { SubtitleRules } from '#shared/utils/subtitleQuality'

export interface GeneralSettings {
  siteName: string
  supportEmail: string
  publicUrl: string
}

export interface VideoSettings {
  maxTagsPerVideo: number
  maxCategoriesPerVideo: number
  requireCategory: boolean
  statisticsDefaultDays: number
}

export interface TranslationSettings {
  defaultTargetLanguages: string[]
  standardRules: SubtitleRules
  compactRules: SubtitleRules
  compactLanguages: string[]
  blockPublishWithIssues: boolean
}

export interface AiSettings {
  enabled: boolean
  summaryEnabled: boolean
  chaptersEnabled: boolean
  keyPointsEnabled: boolean
  questionsEnabled: boolean
  quizEnabled: boolean
  chatEnabled: boolean
  model: string
  fallbackModel: string
  generationEffort: string
  chatEffort: string
  monthlyBudgetUsd: number | null
  budgetEnforced: boolean
  maxChatMessageChars: number
  defaultKeyPoints: number
  defaultQuestions: number
  defaultQuizQuestions: number
}

export interface StorageSettings {
  maxUploadMb: number
  allowedUploadTypes: string[]
  maxSubtitleUploadMb: number
  storageQuotaGb: number | null
}

export interface SettingsBySection {
  general: GeneralSettings
  video: VideoSettings
  translation: TranslationSettings
  ai: AiSettings
  storage: StorageSettings
}

export type SettingsSection = keyof SettingsBySection

export interface SectionView<S extends SettingsSection = SettingsSection> {
  section: S
  values: SettingsBySection[S]
  defaults: SettingsBySection[S]
  /** False while the section is on its built-in defaults. */
  customized: boolean
  /** Send back on save; a stale one is refused with 409. */
  version: number | null
  updatedBy: string | null
  updatedAt: string | null
  /** Read-only facts about the server's configuration. */
  info: Record<string, unknown>
}

export interface ClientSettings {
  siteName: string
  maxTagsPerVideo: number
  maxCategoriesPerVideo: number
  requireCategory: boolean
  statisticsDefaultDays: number
  defaultTargetLanguages: string[]
  blockPublishWithIssues: boolean
  maxUploadMb: number
  allowedUploadTypes: string[]
  maxSubtitleUploadMb: number
  standardRules: SubtitleRules
  compactRules: SubtitleRules
  compactLanguages: string[]
}

export function useSettings() {
  const api = useApi()
  const base = '/api/admin/settings'

  async function get<S extends SettingsSection>(section: S) {
    return (await api<ApiEnvelope<SectionView<S>>>(`${base}/${section}`)).data
  }

  async function save<S extends SettingsSection>(section: S, values: SettingsBySection[S], version: number | null) {
    const res = await api<ApiEnvelope<SectionView<S>>>(`${base}/${section}`, {
      method: 'PUT',
      body: values,
      // -1 = "it was on defaults when I read it" — still checked for conflicts.
      query: { version: version ?? -1 }
    })
    await useClientSettings().refresh()
    return res.data
  }

  async function reset<S extends SettingsSection>(section: S) {
    const res = await api<ApiEnvelope<SectionView<S>>>(`${base}/${section}`, { method: 'DELETE' })
    await useClientSettings().refresh()
    return res.data
  }

  return { get, save, reset }
}

/** Shared, lazily loaded client settings (limits and defaults used across pages). */
export function useClientSettings() {
  const state = useState<ClientSettings | null>('client-settings', () => null)

  async function refresh() {
    try {
      const res = await useApi()<ApiEnvelope<ClientSettings>>('/api/settings/client')
      state.value = res.data
      setSubtitleRuleDefaults(res.data)
    } catch {
      // Keep what we had; pages fall back to their built-in defaults.
    }
  }

  return { settings: state, refresh }
}
