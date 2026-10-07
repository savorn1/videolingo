// Wraps the backend's VideoController (/api/admin/videos/**), gated as module
// "videos" (GET = READ, everything else = WRITE). Delete is a soft delete —
// the video moves to the trash (`deleted: true` in the list filter) and can
// be restored.

import { MULTIPART_THRESHOLD, partRange, sendParts } from '#shared/utils/multipartUpload'
import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { VideoSourceKind } from '#shared/utils/videoSources'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export type VideoVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE'

export const VIDEO_VISIBILITIES: {
  value: VideoVisibility
  label: string
  description: string
  icon: string
  color: 'success' | 'info' | 'neutral'
}[] = [
  { value: 'PUBLIC', label: 'Public', description: 'Listed for all learners', icon: 'i-lucide-globe', color: 'success' },
  { value: 'UNLISTED', label: 'Unlisted', description: 'Anyone with the link', icon: 'i-lucide-link', color: 'info' },
  { value: 'PRIVATE', label: 'Private', description: 'Only the owner', icon: 'i-lucide-lock', color: 'neutral' }
]

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
  archived: boolean
  archivedAt: string | null
  visibility: VideoVisibility
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
  visibility?: VideoVisibility
  /** false (default) = live videos, true = trash. */
  deleted?: boolean
  /** false (default) hides archived videos; true lists only archived ones. Ignored when deleted=true. */
  archived?: boolean
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
  visibility?: VideoVisibility
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

  /** Permanently deletes one trashed video and frees its storage. Must already be in the trash. Cannot be undone. */
  async function purge(id: number) {
    await api(`/api/admin/videos/${id}/permanent`, { method: 'DELETE' })
  }

  /** Permanently deletes every trashed video and frees its storage. Cannot be undone. */
  async function purgeTrash() {
    await api('/api/admin/videos/trash', { method: 'DELETE' })
  }

  async function archive(id: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/archive`, { method: 'POST' })).data
  }

  async function unarchive(id: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/unarchive`, { method: 'POST' })).data
  }

  /** Reassigns the video to another user; null clears ownership. */
  async function moveOwner(id: number, ownerId: number | null) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/owner`, { method: 'PUT', body: { ownerId } })).data
  }

  /** A full copy — same file, metadata, categories and tags — disabled until reviewed. */
  async function duplicate(id: number) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/duplicate`, { method: 'POST' })).data
  }

  /** Swaps the video's file for a freshly uploaded one; the old file is kept as a version. */
  async function replace(id: number, payload: { storageKey: string; durationSeconds?: number; width?: number; height?: number }) {
    return (await api<ApiEnvelope<Video>>(`/api/admin/videos/${id}/replace`, { method: 'POST', body: payload })).data
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
  async function requestUpload(kind: UploadKind, file: { name: string; type: string; size: number }) {
    return (
      await api<ApiEnvelope<UploadTicket>>('/api/admin/videos/uploads', {
        method: 'POST',
        body: { kind, fileName: file.name, contentType: file.type || undefined, size: file.size }
      })
    ).data
  }

  /**
   * Sends a file to storage and returns its key. Large files go in parts (shared/utils/multipartUpload.ts): if
   * one keeps failing this throws an UploadInterruptedError whose `resume`, passed back in, carries on from the
   * parts already stored.
   */
  async function uploadFile(
    kind: UploadKind,
    file: File,
    opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal; resume?: ResumableUpload | null } = {}
  ): Promise<{ key: string }> {
    if (file.size < MULTIPART_THRESHOLD) {
      const ticket = await requestUpload(kind, file)
      await uploadToStorage(ticket, file, opts.onProgress, opts.signal)
      return { key: ticket.key }
    }
    const state: ResumableUpload =
      opts.resume && opts.resume.size === file.size
        ? opts.resume
        : {
            ...(
              await api<ApiEnvelope<MultipartTicket>>('/api/admin/videos/uploads/multipart', {
                method: 'POST',
                body: { kind, fileName: file.name, contentType: file.type || undefined, size: file.size }
              })
            ).data,
            size: file.size,
            done: []
          }
    const ref = { key: state.key, uploadId: state.uploadId }
    const done = new Set(state.done)
    try {
      await sendParts({
        size: file.size,
        partSize: state.partSize,
        partCount: state.partCount,
        done,
        signal: opts.signal,
        onProgress: opts.onProgress,
        sendPart: async (n, onBytes) => {
          const part = (
            await api<ApiEnvelope<{ url: string; length: number }>>('/api/admin/videos/uploads/multipart/part', {
              method: 'POST',
              body: { ...ref, partNumber: n, size: file.size }
            })
          ).data
          const [start, end] = partRange(file.size, state.partSize, n)
          await putBlob(part.url, file.slice(start, end), {}, (f) => onBytes(f * (end - start)), opts.signal)
        }
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        // Cancelled: storage can drop the parts sent so far.
        api('/api/admin/videos/uploads/multipart/abort', { method: 'POST', body: ref }).catch(() => {})
        throw err
      }
      throw new UploadInterruptedError(err instanceof Error ? err.message : 'The upload stopped', { ...state, done: [...done] })
    }
    await api('/api/admin/videos/uploads/multipart/complete', { method: 'POST', body: ref })
    return { key: state.key }
  }

  async function create(payload: CreateVideoPayload) {
    return (await api<ApiEnvelope<Video>>('/api/admin/videos', { method: 'POST', body: payload })).data
  }

  /** Joins stored videos into one new (hidden) video, in the order given. Queues a job. */
  async function mergeVideos(payload: MergeVideosPayload) {
    return (await api<ApiEnvelope<{ video: Video; job: ProcessingJob }>>('/api/admin/videos/merge', { method: 'POST', body: payload })).data
  }

  /** A video made from an uploaded sound (a still picture plus the audio). Queues a job; the video stays disabled until reviewed. */
  /** Where to cut a long recording into parts of about `partMinutes`, at its pauses (found on the server, on the spot). */
  async function chaptersFromAudio(audioKey: string, partMinutes: number) {
    return (
      await api<ApiEnvelope<{ totalMs: number; parts: { startMs: number; endMs: number }[] }>>('/api/admin/videos/from-audio/chapters', {
        method: 'POST',
        body: { audioKey, partMinutes }
      })
    ).data
  }

  async function createFromAudio(payload: AudioToVideoPayload) {
    return (await api<ApiEnvelope<{ video: Video; job: ProcessingJob }>>('/api/admin/videos/from-audio', { method: 'POST', body: payload })).data
  }

  /** A few seconds of a waveform look drawn from the real sound, to judge it before the video is made. Rendered on the spot (a few seconds). */
  async function previewFromAudio(payload: {
    audioKey: string
    background?: string
    waveform: string
    waveColor?: string
    normalize?: boolean
    denoise?: boolean
    waveHeightPct?: number
  }) {
    return (await api<ApiEnvelope<{ url: string; seconds: number }>>('/api/admin/videos/from-audio/preview', { method: 'POST', body: payload })).data
  }

  return {
    list,
    get,
    statistics,
    update,
    updateStatus,
    remove,
    restore,
    purge,
    purgeTrash,
    archive,
    unarchive,
    moveOwner,
    duplicate,
    replace,
    inspect,
    detectLanguage,
    requestUpload,
    uploadFile,
    create,
    createFromAudio,
    chaptersFromAudio,
    previewFromAudio,
    mergeVideos
  }
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

export type UploadKind = 'VIDEO' | 'THUMBNAIL' | 'AUDIO' | 'OVERLAY'

/** A large upload started in parts (VideoIngestDtos.MultipartTicket). */
export interface MultipartTicket {
  key: string
  uploadId: string
  partSize: number
  partCount: number
  publicUrl: string
  contentType: string
}

/** Where an upload in parts stopped: pass it back to uploadFile to carry on. */
export interface ResumableUpload extends MultipartTicket {
  size: number
  /** Parts already in storage. */
  done: number[]
}

/** An upload in parts that stopped part-way; `resume` carries on from there. */
export class UploadInterruptedError extends Error {
  constructor(
    message: string,
    readonly resume: ResumableUpload
  ) {
    super(message)
    this.name = 'UploadInterruptedError'
  }
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

export interface MergeVideosPayload {
  /** In the order they should play. */
  videoIds: number[]
  title: string
  description?: string
  resolution?: string
  /** NONE or FADE. */
  transition?: string
  language?: string
  categoryIds?: number[]
}

export interface AudioToVideoPayload {
  /** From an upload ticket of kind AUDIO. */
  audioKey: string
  /** From an upload ticket of kind OVERLAY. */
  coverKey?: string
  /** A slideshow: pictures (upload keys) with the time each appears; the first at 0. Use instead of coverKey. */
  slides?: { key: string; startMs: number }[]
  /** "#rrggbb". */
  background?: string
  resolution?: string
  /** NONE, WAVES, BARS, SPIKES, DOTS, SPECTRUM, PULSE, BLOCKS, FINE, STRIPES, REFLECT, COLUMNS or STEREO: a moving waveform (bottom or middle of the picture). */
  waveform?: string
  waveColor?: string
  /** Write text on the background (no cover picture). */
  titleCard?: boolean
  cardText?: string
  normalize?: boolean
  denoise?: boolean
  /** Transcribe the finished video (needs a language). */
  transcribe?: boolean
  /** WIDE (default), TALL (9:16) or SQUARE. */
  shape?: string
  /** A slow zoom on the pictures; dissolves between them. */
  motion?: boolean
  crossfade?: boolean
  /** A strip of text over the picture; a logo (an OVERLAY upload) in the top-right corner. */
  stripText?: string
  logoKey?: string
  /** Take the silence off the start and end of the recording. */
  trimSilence?: boolean
  /** Only this part of the recording (a chapter). */
  audioStartMs?: number
  audioEndMs?: number
  /** The waveform's height, % of the picture (10–80); left out, the style's usual height. */
  waveHeightPct?: number
  /** Burn the transcript into the picture once it is made (needs transcribe). */
  burnSubtitles?: { style: string; position: string }
  title: string
  description?: string
  language?: string
  categoryIds?: number[]
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
  return putBlob(ticket.uploadUrl, body, ticket.headers, onProgress, signal)
}

/** A PUT of `body` to a signed URL, with upload progress (fetch can't report it). */
export function putBlob(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the upload (HTTP ${xhr.status})`)))
    xhr.onerror = () => reject(new Error('The upload failed — check your connection and try again'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}
