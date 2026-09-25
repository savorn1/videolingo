// Wraps the backend's VideoDubController (/api/admin/videos/{id}/dubs),
// gated as module "videos": GET = READ, create/delete = WRITE. A dub is a
// voice-over audio track in another language, made by a DUB processing job
// (transcribe → translate → text-to-speech).

import type { ApiEnvelope } from '#shared/types'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export interface DubVoice {
  id: string
  name: string
  gender: string
}

export interface VideoDub {
  id: number
  videoId: number
  language: string
  languageName: string
  voice: string
  voiceName: string
  audioUrl: string
  mimeType: string | null
  durationMs: number
  sizeBytes: number
  jobId: number | null
  transcriptId: number | null
  createdBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface DubOverview {
  /** OpenAI key set — needed only when the video has no transcript yet. */
  speechToTextReady: boolean
  /** Azure Speech key set — needed for every voice-over. */
  textToSpeechReady: boolean
  /** Claude available — needed when the dub language has no transcript yet. */
  translationReady: boolean
  spokenLanguage: string | null
  /** Voices per language code. */
  voices: Record<string, DubVoice[]>
  dubs: VideoDub[]
  /** Latest DUB jobs for this video, newest first. */
  jobs: ProcessingJob[]
}

export function useDubs() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/dubs`

  async function overview(videoId: number) {
    return (await api<ApiEnvelope<DubOverview>>(base(videoId))).data
  }

  async function create(videoId: number, body: { language: string; voice?: string }) {
    return (await api<ApiEnvelope<ProcessingJob>>(base(videoId), { method: 'POST', body })).data
  }

  async function remove(videoId: number, dubId: number) {
    await api(`${base(videoId)}/${dubId}`, { method: 'DELETE' })
  }

  return { overview, create, remove }
}
