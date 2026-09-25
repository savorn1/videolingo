// Wraps the backend's VideoDownloadController (/api/admin/videos/{id}/downloads),
// gated as module "videos": GET = READ, start/delete = WRITE. Both kinds run
// as DOWNLOAD processing jobs:
//   FILE   — an MP4 to save (≤ 720p; optionally with a voice-over as its
//            sound), kept for 24 hours;
//   IMPORT — a YouTube/Vimeo/Facebook video copied into our storage, after
//            which it plays from there.

import type { ApiEnvelope } from '#shared/types'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export type DownloadMode = 'FILE' | 'IMPORT'

export interface VideoExport {
  id: number
  jobId: number | null
  /** Voice-over language used as the sound; null = original sound. */
  audioLanguage: string | null
  /** Label of the subtitle track burned into the picture, if any. */
  subtitleLabel: string | null
  fileName: string
  url: string
  sizeBytes: number
  createdAt: string
  expiresAt: string
}

export interface DownloadOverview {
  /** YouTube / Vimeo / Facebook — downloading needs the rights confirmation. */
  isLink: boolean
  canImport: boolean
  importedFrom: string | null
  /** Prepared downloads that haven't expired yet, newest first. */
  exports: VideoExport[]
  /** Latest DOWNLOAD jobs, newest first. */
  jobs: ProcessingJob[]
}

export function useVideoDownloads() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/downloads`

  async function overview(videoId: number) {
    return (await api<ApiEnvelope<DownloadOverview>>(base(videoId))).data
  }

  /** `subtitleId` burns that track's cues into the picture (FILE only; re-encodes, so it's slower). */
  async function start(videoId: number, body: { mode: DownloadMode; audio?: string | null; rightsConfirmed?: boolean; subtitleId?: number | null }) {
    return (await api<ApiEnvelope<ProcessingJob>>(base(videoId), { method: 'POST', body })).data
  }

  async function remove(videoId: number, exportId: number) {
    await api(`${base(videoId)}/${exportId}`, { method: 'DELETE' })
  }

  return { overview, start, remove }
}
