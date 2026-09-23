// Wraps the backend's SubtitleController (/api/admin/subtitles/**), gated as
// module "subtitles": GETs (incl. download) = READ, the rest = WRITE.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { SubtitleIssue, SubtitleRules } from '#shared/utils/subtitleQuality'

export type SubtitleSource = 'GENERATED' | 'UPLOADED' | 'MANUAL'
export type SubtitleKind = 'SUBTITLES' | 'CAPTIONS'
export type SubtitleFormat = 'vtt' | 'srt'

export interface SubtitleCue {
  id?: number
  startMs: number
  endMs: number
  /** May contain \n line breaks. */
  text: string
}

export interface Subtitle {
  id: number
  videoId: number
  videoTitle: string | null
  videoUrl: string | null
  language: string
  label: string
  kind: SubtitleKind
  source: SubtitleSource
  transcriptId: number | null
  transcriptLanguage: string | null
  published: boolean
  isDefault: boolean
  rules: SubtitleRules
  cueCount: number
  issueCount: number
  durationMs: number
  originalFilename: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
  version: number
  /** Detail only. */
  cues: SubtitleCue[] | null
  issues: SubtitleIssue[] | null
  /** Upload only: cues the parser skipped. */
  warnings: string[] | null
}

export interface SubtitleFilter {
  /** Video title or track label. */
  search?: string
  videoId?: number
  language?: string
  source?: SubtitleSource
  published?: boolean
  hasIssues?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateSubtitlePayload {
  videoId: number
  /** Generate from this transcript (the track takes its language)… */
  transcriptId?: number
  /** …or create an empty track in this language. */
  language?: string
  label?: string
  kind?: SubtitleKind
  rules?: SubtitleRules
}

export interface UpdateSubtitlePayload {
  version: number
  label: string
  language: string
  kind: SubtitleKind
  published: boolean
  rules: SubtitleRules
  /** Omit to keep the cues as they are. */
  cues?: SubtitleCue[]
}

export const SUBTITLE_SOURCES: { value: SubtitleSource; label: string; color: 'info' | 'neutral' | 'secondary'; icon: string }[] = [
  { value: 'GENERATED', label: 'Generated', color: 'info', icon: 'i-lucide-sparkles' },
  { value: 'UPLOADED', label: 'Uploaded', color: 'secondary', icon: 'i-lucide-file-up' },
  { value: 'MANUAL', label: 'Manual', color: 'neutral', icon: 'i-lucide-pencil' }
]

export const SUBTITLE_KINDS: { value: SubtitleKind; label: string; description: string }[] = [
  { value: 'SUBTITLES', label: 'Subtitles', description: 'Dialogue only' },
  { value: 'CAPTIONS', label: 'Captions', description: 'Dialogue plus sounds, e.g. [door slams]' }
]

export function useSubtitles() {
  const api = useApi()
  const base = '/api/admin/subtitles'

  function list(filter: SubtitleFilter = {}) {
    return api<PageEnvelope<Subtitle>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Subtitle>>(`${base}/${id}`)).data
  }

  async function create(payload: CreateSubtitlePayload) {
    return (await api<ApiEnvelope<Subtitle>>(base, { method: 'POST', body: payload })).data
  }

  /** Multipart upload of a .srt/.vtt file; the response carries any parser `warnings`. */
  async function upload(params: { file: File; videoId: number; language: string; label?: string; kind?: SubtitleKind }) {
    const form = new FormData()
    form.append('file', params.file)
    form.append('videoId', String(params.videoId))
    form.append('language', params.language)
    if (params.label) form.append('label', params.label)
    if (params.kind) form.append('kind', params.kind)
    return (await api<ApiEnvelope<Subtitle>>(`${base}/upload`, { method: 'POST', body: form })).data
  }

  async function update(id: number, payload: UpdateSubtitlePayload) {
    return (await api<ApiEnvelope<Subtitle>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  async function setDefault(id: number) {
    return (await api<ApiEnvelope<Subtitle>>(`${base}/${id}/default`, { method: 'PUT' })).data
  }

  /** Rebuilds cues from a transcript (same one by default), replacing manual edits. */
  async function regenerate(id: number, body: { transcriptId?: number; rules?: SubtitleRules } = {}) {
    return (await api<ApiEnvelope<Subtitle>>(`${base}/${id}/regenerate`, { method: 'POST', body })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  /** Downloads the track as a file named the way the server suggests. */
  async function download(id: number, format: SubtitleFormat) {
    const res = await api.raw<Blob>(`${base}/${id}/download`, { query: { format }, responseType: 'blob' })
    const disposition = res.headers.get('content-disposition') ?? ''
    const match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition) ?? /filename\s*=\s*"?([^";]+)"?/i.exec(disposition)
    const filename = match ? decodeURIComponent(match[1]!.trim()) : `subtitle-${id}.${format}`
    const url = URL.createObjectURL(res._data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return filename
  }

  return { list, get, create, upload, update, setDefault, regenerate, remove, download }
}
