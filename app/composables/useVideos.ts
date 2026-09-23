// Wraps the backend's VideoController (/api/admin/videos/**), gated as module
// "videos" (GET = READ, everything else = WRITE). Delete is a soft delete —
// the video moves to the trash (`deleted: true` in the list filter) and can
// be restored.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export interface Video {
  id: number
  title: string
  description: string | null
  ownerId: number | null
  // Null when the owner account has since been deleted.
  ownerUsername: string | null
  language: string | null
  videoUrl: string
  // S3 object key when stored in our bucket; null for an external URL.
  storageKey: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  fileSize: number | null
  mimeType: string | null
  enabled: boolean
  deleted: boolean
  deletedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  viewCount: number
  /** Display order (category sortOrder, then name). */
  categories: { id: number; name: string; color: string | null; enabled: boolean }[]
  /** Alphabetical. */
  tags: { id: number; name: string; slug: string }[]
}

export interface VideoFilter {
  /** Case-insensitive match on title or description. */
  search?: string
  ownerId?: number
  language?: string
  enabled?: boolean
  categoryId?: number
  tagId?: number
  /** false (default) = live videos, true = trash. */
  deleted?: boolean
  /** yyyy-mm-dd, inclusive. */
  createdFrom?: string
  createdTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface UpdateVideoPayload {
  title: string
  description?: string
  language?: string
  thumbnailUrl?: string
  /** Replaces the video's categories; omit to leave them unchanged. */
  categoryIds?: number[]
}

export interface VideoStatistics {
  totalViews: number
  /** Signed-in viewers only. */
  uniqueViewers: number
  totalWatchSeconds: number
  averageWatchSeconds: number
  /** 0–100 */
  completionRate: number
  /** 0–100, null when the video's duration is unknown. */
  averagePercentWatched: number | null
  lastViewedAt: string | null
  days: number
  /** Oldest first, one entry per day, zero-filled. */
  dailyViews: { date: string; views: number }[]
}

export function useVideos() {
  const api = useApi()

  function list(filter: VideoFilter = {}) {
    return api<PageEnvelope<Video>>('/api/admin/videos', { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}`)).data
  }

  async function statistics(id: number, days = 30) {
    return (await api<ApiEnvelope<VideoStatistics>>(`/api/admin/videos/${id}/statistics`, { query: { days } })).data
  }

  async function update(id: number, payload: UpdateVideoPayload) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}`, { method: 'PUT', body: payload })).data
  }

  async function updateStatus(id: number, enabled: boolean) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/status`, { method: 'PUT', body: { enabled } })).data
  }

  async function remove(id: number) {
    await api(`/api/admin/videos/${id}`, { method: 'DELETE' })
  }

  async function restore(id: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/restore`, { method: 'POST' })).data
  }

  return { list, get, statistics, update, updateStatus, remove, restore }
}
