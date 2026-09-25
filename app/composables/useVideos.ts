// Wraps the backend's VideoController (/api/admin/videos/**), gated as module
// "videos" (GET = READ, everything else = WRITE). Delete is a soft delete —
// the video moves to the trash (`deleted: true` in the list filter) and can
// be restored.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { VideoSourceKind } from '#shared/utils/videoSources'

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
  /** Original link, when the video was imported from YouTube/Vimeo/Facebook into our storage. */
  importedFrom: string | null
  /** Where the media lives: our bucket, a platform (played via embedUrl) or an external file. */
  source: VideoSourceKind
  /** The platform's own id (YouTube/Vimeo/Facebook). */
  externalId: string | null
  /** Channel / page name reported by the platform. */
  sourceAuthor: string | null
  /** Platform player to embed; null when the video plays as a file from videoUrl. */
  embedUrl: string | null
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

  // ── Add Video ────────────────────────────────────────────────────────────

  /** Checks a pasted link and fetches what the platform says about it. */
  async function inspect(url: string) {
    return (await api<ApiEnvelope<InspectedLink>>('/api/admin/videos/inspect', { method: 'POST', body: { url } })).data
  }

  async function detectLanguage(title: string, description?: string | null) {
    return (await api<ApiEnvelope<LanguageGuess | null>>('/api/admin/videos/detect-language', { method: 'POST', body: { title, description } })).data
  }

  /** A signed, size-locked PUT straight to storage. */
  async function requestUpload(kind: 'VIDEO' | 'THUMBNAIL', file: { name: string; type: string; size: number }) {
    return (
      await api<ApiEnvelope<UploadTicket>>('/api/admin/videos/uploads', {
        method: 'POST',
        body: { kind, fileName: file.name, contentType: file.type || undefined, size: file.size }
      })
    ).data
  }

  async function create(payload: CreateVideoPayload) {
    return (await api<ApiEnvelope<Video>>('/api/admin/videos', { method: 'POST', body: payload })).data
  }

  return { list, get, statistics, update, updateStatus, remove, restore, inspect, detectLanguage, requestUpload, create }
}

export interface LanguageGuess {
  code: string
  /** Null when the code isn't in the language catalog. */
  name: string | null
  /** 0–1 */
  confidence: number
  /** "platform": reported by YouTube's own captions; "text": guessed from the title/description. */
  source: 'platform' | 'text'
  inCatalog: boolean
  enabled: boolean
}

export interface InspectedLink {
  /** Canonical link that will be stored. */
  url: string
  source: VideoSourceKind
  kind: 'VIDEO' | 'SHORT' | 'REEL' | 'LIVE' | 'FILE'
  externalId: string | null
  embedUrl: string | null
  title: string | null
  description: string | null
  durationSeconds: number | null
  thumbnailUrl: string | null
  width: number | null
  height: number | null
  author: string | null
  mimeType: string | null
  fileSize: number | null
  language: LanguageGuess | null
  warnings: string[]
  /** Existing videos with the same platform id or link. */
  duplicates: { id: number; title: string; trashed: boolean }[]
}

export interface UploadTicket {
  key: string
  uploadUrl: string
  method: 'PUT'
  headers: Record<string, string>
  expiresAt: string
  publicUrl: string
  contentType: string
}

export interface CreateVideoPayload {
  mode: 'LINK' | 'UPLOAD'
  url?: string
  storageKey?: string
  title: string
  description?: string
  language?: string
  durationSeconds?: number
  width?: number
  height?: number
  thumbnailUrl?: string
  sourceAuthor?: string
  mimeType?: string
  categoryIds: number[]
  enabled: boolean
  allowDuplicate?: boolean
}

/**
 * PUTs a file to a signed storage URL with progress (fetch can't report
 * upload progress, hence XHR). Resolves when stored; rejects on failure or abort.
 */
export function uploadToStorage(ticket: UploadTicket, body: Blob, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(ticket.method, ticket.uploadUrl)
    for (const [k, v] of Object.entries(ticket.headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (HTTP ${xhr.status})`)))
    xhr.onerror = () => reject(new Error('The upload failed — check your connection and try again'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}
