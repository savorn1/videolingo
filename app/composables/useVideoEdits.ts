// Wraps the backend's VideoEditController (/api/admin/videos/{id}/edits),
// gated as module "videos": GET = READ, the rest = WRITE. Trim/crop, split,
// audio edits and audio extracts all run as EDIT processing jobs, producing
// clips to review before promoting (TRIM and AUDIO replace the video's file;
// SPLIT segments become new, disabled videos), downloading (EXTRACT) or
// discarding.

import type { ApiEnvelope } from '#shared/types'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export type ClipOperation = 'TRIM' | 'SPLIT' | 'AUDIO' | 'EXTRACT'

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export interface ScaleSize {
  w: number
  h: number
}

export interface SegmentRange {
  startMs: number
  endMs: number | null
}

export interface VideoClip {
  id: number
  jobId: number | null
  operation: ClipOperation
  /** Null for TRIM; this segment's place among a SPLIT job's outputs otherwise. */
  segmentIndex: number | null
  startMs: number
  endMs: number | null
  crop: CropRect | null
  scale: ScaleSize | null
  url: string
  sizeBytes: number
  durationSeconds: number | null
  width: number | null
  height: number | null
  /** AUDIO: what the edit changed; EXTRACT: the format. */
  summary: string | null
  createdAt: string
  expiresAt: string
}

/** An audio edit. Anything left out keeps the sound as it is; times are on the video's 1× timeline. */
export interface AudioEditRequest {
  /** An uploaded file (kind AUDIO) to use instead of the video's own sound. */
  replaceKey?: string | null
  /** Pieces of the source sound and where they go; omit to keep it whole. */
  clips?: { srcStartMs: number; srcEndMs: number; atMs: number; gain: number }[]
  mutes?: { startMs: number; endMs: number }[]
  /** 1 = unchanged, up to 4. */
  volume?: number
  fadeInMs?: number
  fadeOutMs?: number
  normalize?: boolean
  denoise?: 'OFF' | 'LIGHT' | 'STRONG'
  enhanceVoice?: boolean
  /** 0.5–2; the picture follows. */
  speed?: number
  /** -12…12 */
  pitchSemitones?: number
  /** -1 (left) … 1 (right) */
  balance?: number
  channels?: 'KEEP' | 'MONO' | 'STEREO'
  music?: { key: string; volume: number; loop: boolean; duck: boolean; startMs: number } | null
}

export interface EditOverview {
  /** Clips awaiting a decision, newest first. */
  clips: VideoClip[]
  /** Latest EDIT jobs, newest first. */
  jobs: ProcessingJob[]
}

export interface PromoteResult {
  kind: 'REPLACED' | 'NEW_VIDEO'
  newVideoId: number | null
}

export function useVideoEdits() {
  const api = useApi()
  const base = (videoId: number) => `/api/admin/videos/${videoId}/edits`

  async function overview(videoId: number) {
    return (await api<ApiEnvelope<EditOverview>>(base(videoId))).data
  }

  async function startTrim(videoId: number, body: { startMs: number; endMs?: number | null; crop?: CropRect | null; scale?: ScaleSize | null }) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/trim`, { method: 'POST', body })).data
  }

  async function startSplit(videoId: number, segments: SegmentRange[]) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/split`, { method: 'POST', body: { segments } })).data
  }

  async function startAudio(videoId: number, body: AudioEditRequest) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/audio`, { method: 'POST', body })).data
  }

  async function startExtract(videoId: number, format: 'MP3' | 'WAV') {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/extract-audio`, { method: 'POST', body: { format } })).data
  }

  async function promote(videoId: number, clipId: number) {
    return (await api<ApiEnvelope<PromoteResult>>(`${base(videoId)}/${clipId}/promote`, { method: 'POST' })).data
  }

  async function remove(videoId: number, clipId: number) {
    await api(`${base(videoId)}/${clipId}`, { method: 'DELETE' })
  }

  return { overview, startTrim, startSplit, startAudio, startExtract, promote, remove }
}
