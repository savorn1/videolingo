// Tags: the admin TagController (/api/admin/tags/**, module "tags"), the
// public autocomplete at /api/tags, and the video-side assign/remove endpoints
// (/api/admin/videos/{id}/tags — governed by the "videos" permission).

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { Video } from './useVideos'

export interface Tag {
  id: number
  name: string
  slug: string
  description: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Live videos carrying it; null in suggestions. */
  videoCount: number | null
}

export interface TagPayload {
  name: string
  /** Blank = generate (create) / keep (update). */
  slug?: string
  description?: string
}

export interface TagFilter {
  search?: string
  /** true = only tags no live video uses. */
  unused?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

/** Same normalisation the backend applies, so "#Slang " matches the existing "slang". */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function useTags() {
  const api = useApi()
  const base = '/api/admin/tags'

  function list(filter: TagFilter = {}) {
    return api<PageEnvelope<Tag>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Tag>>(`${base}/${id}`)).data
  }

  async function create(payload: TagPayload) {
    return (await api<ApiEnvelope<Tag>>(base, { method: 'POST', body: payload })).data
  }

  async function update(id: number, payload: TagPayload) {
    return (await api<ApiEnvelope<Tag>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  /** Returns how many videos the tag was removed from. */
  async function remove(id: number) {
    return (await api<ApiEnvelope<number>>(`${base}/${id}`, { method: 'DELETE' })).data
  }

  /** Autocomplete — prefix matches first, at most `limit`. */
  async function suggest(q: string, limit = 8) {
    const res = await $fetch<ApiEnvelope<Tag[]>>('/api/tags', { baseURL: useRuntimeConfig().public.apiBase, query: { q, limit } })
    return res.data
  }

  /** Assign Tag to Video (adds; tags already on the video are ignored). */
  async function assignToVideo(videoId: number, tagIds: number[]) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${videoId}/tags`, { method: 'POST', body: { tagIds } })).data
  }

  /** Remove Tag from Video. */
  async function removeFromVideo(videoId: number, tagId: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${videoId}/tags/${tagId}`, { method: 'DELETE' })).data
  }

  return { list, get, create, update, remove, suggest, assignToVideo, removeFromVideo }
}
