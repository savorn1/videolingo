// Wraps the backend's CategoryController (/api/admin/categories/**, module
// "categories": GET = READ, rest = WRITE) plus the public catalog at
// /api/categories that feeds category pickers and badges app-wide.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  sortOrder: number
  enabled: boolean
  createdAt: string | null
  updatedAt: string | null
  /** Live (non-trashed) videos filed under it. */
  videoCount: number
}

export interface CategoryPayload {
  name: string
  /** Blank = generate from the name (create) / keep the current one (update). */
  slug?: string
  description?: string
  color?: string
  sortOrder?: number
  /** Create only. */
  enabled?: boolean
}

export interface CategoryFilter {
  search?: string
  enabled?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export function useCategories() {
  const api = useApi()
  const base = '/api/admin/categories'

  async function refreshCatalog() {
    try {
      const res = await $fetch<ApiEnvelope<CatalogCategory[]>>('/api/categories', { baseURL: useRuntimeConfig().public.apiBase })
      setCategoryCatalog(res.data)
    } catch {
      // keep what we have
    }
  }

  function list(filter: CategoryFilter = {}) {
    return api<PageEnvelope<Category>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Category>>(`${base}/${id}`)).data
  }

  async function create(payload: CategoryPayload) {
    const res = await api<ApiEnvelope<Category>>(base, { method: 'POST', body: payload })
    await refreshCatalog()
    return res.data
  }

  async function update(id: number, payload: CategoryPayload) {
    const res = await api<ApiEnvelope<Category>>(`${base}/${id}`, { method: 'PUT', body: payload })
    await refreshCatalog()
    return res.data
  }

  async function setEnabled(id: number, enabled: boolean) {
    const res = await api<ApiEnvelope<Category>>(`${base}/${id}/status`, { method: 'PUT', body: { enabled } })
    await refreshCatalog()
    return res.data
  }

  /** Returns how many videos the category was removed from. */
  async function remove(id: number) {
    const res = await api<ApiEnvelope<number>>(`${base}/${id}`, { method: 'DELETE' })
    await refreshCatalog()
    return res.data
  }

  return { refreshCatalog, list, get, create, update, setEnabled, remove }
}
