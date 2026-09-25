// Wraps the backend's TranscriptController (/api/admin/transcripts/**), gated
// as module "transcripts": GETs (list, search, export) = READ, the rest = WRITE.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { JobStatus } from '#shared/utils/processingJobs'
import type { ProcessingJob } from './useProcessingJobs'

export type TranscriptSource = 'AUTO' | 'MANUAL' | 'IMPORTED'
export type TranscriptExportFormat = 'srt' | 'vtt' | 'txt' | 'json'

export interface TranscriptSegment {
  id?: number
  startMs: number
  endMs: number
  text: string
  speaker?: string | null
}

export interface Transcript {
  id: number
  videoId: number
  videoTitle: string | null
  /** The video's spoken language — a transcript in any other language is a translation. */
  videoLanguage: string | null
  videoDurationSeconds: number | null
  videoUrl: string | null
  language: string
  source: TranscriptSource
  segmentCount: number
  wordCount: number
  durationMs: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Send back on update — a stale version is rejected with 409. */
  version: number
  lastJobId: number | null
  lastJobStatus: JobStatus | null
  lastJobProgress: number | null
  /** Only on the single-transcript response. */
  segments: TranscriptSegment[] | null
}

export interface TranscriptFilter {
  /** Matches the video title. */
  search?: string
  videoId?: number
  language?: string
  source?: TranscriptSource
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface TranscriptSearchHit {
  transcriptId: number
  videoId: number
  videoTitle: string
  language: string
  segmentId: number
  position: number
  startMs: number
  endMs: number
  text: string
}

export interface CreateTranscriptPayload {
  videoId: number
  language: string
  source: 'MANUAL' | 'IMPORTED'
  segments: TranscriptSegment[]
}

export interface UpdateTranscriptPayload {
  version: number
  language: string
  segments: TranscriptSegment[]
}

export const TRANSCRIPT_SOURCES: { value: TranscriptSource; label: string; color: 'info' | 'neutral' | 'secondary'; icon: string }[] = [
  { value: 'AUTO', label: 'Automatic', color: 'info', icon: 'i-lucide-sparkles' },
  { value: 'MANUAL', label: 'Manual', color: 'neutral', icon: 'i-lucide-pencil' },
  { value: 'IMPORTED', label: 'Imported', color: 'secondary', icon: 'i-lucide-file-up' }
]

export const EXPORT_FORMATS: { value: TranscriptExportFormat; label: string; description: string }[] = [
  { value: 'srt', label: 'SubRip (.srt)', description: 'Most video players and editors' },
  { value: 'vtt', label: 'WebVTT (.vtt)', description: 'HTML5 <track>, keeps speakers' },
  { value: 'txt', label: 'Plain text (.txt)', description: 'Text only, no timings' },
  { value: 'json', label: 'JSON (.json)', description: 'Timings in seconds, for scripts' }
]

export function useTranscripts() {
  const api = useApi()
  const base = '/api/admin/transcripts'

  function list(filter: TranscriptFilter = {}) {
    return api<PageEnvelope<Transcript>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Transcript>>(`${base}/${id}`)).data
  }

  async function create(payload: CreateTranscriptPayload) {
    return (await api<ApiEnvelope<Transcript>>(base, { method: 'POST', body: payload })).data
  }

  async function update(id: number, payload: UpdateTranscriptPayload) {
    return (await api<ApiEnvelope<Transcript>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  /** Queues a Transcribe (or, for a translation, Translate) job. */
  async function regenerate(id: number) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base}/${id}/regenerate`, { method: 'POST' })).data
  }

  function search(params: { q: string; videoId?: number; language?: string; page?: number; size?: number }) {
    return api<PageEnvelope<TranscriptSearchHit>>(`${base}/search`, { query: params })
  }

  /** Downloads the export, named the way the server suggests. */
  async function exportFile(id: number, format: TranscriptExportFormat) {
    const res = await api.raw<Blob>(`${base}/${id}/export`, { query: { format }, responseType: 'blob' })
    const filename = filenameFromDisposition(res.headers.get('content-disposition')) ?? `transcript-${id}.${format}`
    const url = URL.createObjectURL(res._data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return filename
  }

  return { list, get, create, update, remove, regenerate, search, exportFile }
}

/** What a revision of a transcript holds. */
export interface TranscriptSnapshot {
  language: string
  segments: TranscriptSegment[] | null
}

// Prefers the RFC 5987 `filename*` (UTF-8, so non-Latin titles survive) over
// the ASCII `filename` fallback.
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const extended = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)
  if (extended) {
    try {
      return decodeURIComponent(extended[1]!.trim())
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header)
  return plain ? plain[1]!.trim() : null
}
