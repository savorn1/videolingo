// Wraps the backend's CollectionController (/api/admin/collections/**, module
// "collections": GET = READ, everything else — incl. adding/removing videos — WRITE).

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export type CollectionVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'

export interface Collection {
  id: number
  title: string
  slug: string
  description: string | null
  coverUrl: string | null
  ownerId: number | null
  ownerUsername: string | null
  visibility: CollectionVisibility
  videoCount: number
  createdAt: string | null
  updatedAt: string | null
  /** Detail only. */
  totalDurationSeconds?: number | null
  trashedVideoCount?: number | null
  disabledVideoCount?: number | null
}

export interface CollectionVideo {
  position: number
  /** Grouping label ("Week 1"); null if this video isn't in a section. */
  section: string | null
  videoId: number
  title: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  language: string | null
  enabled: boolean
  deleted: boolean
  addedBy: string | null
  addedAt: string | null
}

export interface CollectionVideoStat {
  videoId: number
  title: string | null
  started: number
  completed: number
  /** Average of each learner's percent watched; null if nobody's started it. */
  avgPercent: number | null
}

export interface CollectionAnalytics {
  uniqueLearners: number
  finishedCourse: number
  videos: CollectionVideoStat[]
}

export interface CollectionPayload {
  title: string
  slug?: string
  description?: string
  coverUrl?: string
  visibility: CollectionVisibility
  ownerId?: number
  /** Create only. */
  videoIds?: number[]
}

export interface CollectionFilter {
  search?: string
  visibility?: CollectionVisibility
  ownerId?: number
  /** Collections containing this video. */
  videoId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export const COLLECTION_VISIBILITIES: {
  value: CollectionVisibility
  label: string
  description: string
  icon: string
  color: 'success' | 'info' | 'neutral'
}[] = [
  { value: 'PUBLIC', label: 'Public', description: 'Listed for all learners', icon: 'i-lucide-globe', color: 'success' },
  { value: 'UNLISTED', label: 'Unlisted', description: 'Anyone with the link', icon: 'i-lucide-link', color: 'info' },
  { value: 'PRIVATE', label: 'Private', description: 'Only the owner', icon: 'i-lucide-lock', color: 'neutral' }
]

export function useCollections() {
  const api = useApi()
  const base = '/api/admin/collections'

  function list(filter: CollectionFilter = {}) {
    return api<PageEnvelope<Collection>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}`)).data
  }

  async function create(payload: CollectionPayload) {
    return (await api<ApiEnvelope<Collection>>(base, { method: 'POST', body: payload })).data
  }

  async function update(id: number, payload: CollectionPayload) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  /** View Collection Videos — in collection order. */
  function videos(id: number, page = 1, size = 50) {
    return api<PageEnvelope<CollectionVideo>>(`${base}/${id}/videos`, { query: { page, size } })
  }

  /** Appends videos; returns how many were actually added (already-present ones are skipped). */
  async function addVideos(id: number, videoIds: number[]) {
    return (await api<ApiEnvelope<number>>(`${base}/${id}/videos`, { method: 'POST', body: { videoIds } })).data
  }

  /** Remove Video — from the collection only. Returns the updated collection. */
  async function removeVideo(id: number, videoId: number) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}/videos/${videoId}`, { method: 'DELETE' })).data
  }

  /** Saves a new order; `videoIds` must list exactly the collection's videos. */
  async function reorder(id: number, videoIds: number[]) {
    await api(`${base}/${id}/videos/order`, { method: 'PUT', body: { videoIds } })
  }

  /** Sets (or clears, with a blank value) each listed video's section label. */
  async function updateSections(id: number, sections: Record<number, string | null>) {
    await api(`${base}/${id}/videos/sections`, { method: 'PUT', body: { sections } })
  }

  /** Per-video started/completed/average-progress, and how many learners finished the whole course. */
  async function analytics(id: number) {
    return (await api<ApiEnvelope<CollectionAnalytics>>(`${base}/${id}/analytics`)).data
  }

  /** A full copy — same videos, sections and visibility — owned by the acting admin. */
  async function duplicate(id: number) {
    return (await api<ApiEnvelope<Collection>>(`${base}/${id}/duplicate`, { method: 'POST' })).data
  }

  return { list, get, create, update, remove, videos, addVideos, removeVideo, reorder, updateSections, analytics, duplicate }
}
