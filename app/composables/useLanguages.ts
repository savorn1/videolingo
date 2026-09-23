// Wraps the backend's LanguageController (/api/admin/languages/**, module
// "languages": GET = READ, rest = WRITE) plus the public catalog at
// /api/languages that feeds languageLabel()/languageOptions() app-wide.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export interface Language {
  id: number
  code: string
  name: string
  nativeName: string | null
  enabled: boolean
  isDefault: boolean
  createdAt: string | null
  updatedAt: string | null
  videoCount: number
  transcriptCount: number
  /** Why delete / disable is refused right now, or null if allowed. */
  deleteBlockedReason: string | null
  disableBlockedReason: string | null
}

export interface LanguagePayload {
  code: string
  name: string
  nativeName?: string
  /** Create only. */
  enabled?: boolean
}

export interface LanguageFilter {
  search?: string
  enabled?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export function useLanguages() {
  const api = useApi()
  const base = '/api/admin/languages'

  /** Re-reads the public catalog. Call after any change so pickers everywhere update. */
  async function refreshCatalog() {
    try {
      const res = await $fetch<ApiEnvelope<CatalogLanguage[]>>('/api/languages', { baseURL: useRuntimeConfig().public.apiBase })
      setLanguageCatalog(res.data)
    } catch {
      // keep whatever catalog we already have
    }
  }

  function list(filter: LanguageFilter = {}) {
    return api<PageEnvelope<Language>>(base, { query: filter })
  }

  async function create(payload: LanguagePayload) {
    const res = await api<ApiEnvelope<Language>>(base, { method: 'POST', body: payload })
    await refreshCatalog()
    return res.data
  }

  async function update(id: number, payload: LanguagePayload) {
    const res = await api<ApiEnvelope<Language>>(`${base}/${id}`, { method: 'PUT', body: payload })
    await refreshCatalog()
    return res.data
  }

  async function setEnabled(id: number, enabled: boolean) {
    const res = await api<ApiEnvelope<Language>>(`${base}/${id}/status`, { method: 'PUT', body: { enabled } })
    await refreshCatalog()
    return res.data
  }

  async function setDefault(id: number) {
    const res = await api<ApiEnvelope<Language>>(`${base}/${id}/default`, { method: 'PUT' })
    await refreshCatalog()
    return res.data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
    await refreshCatalog()
  }

  return { refreshCatalog, list, create, update, setEnabled, setDefault, remove }
}
