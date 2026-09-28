// Wraps the backend's VideoEditController (/api/admin/videos/{id}/edits),
// gated as module "videos": GET = READ, the rest = WRITE. Both trim/crop and
// split run as EDIT processing jobs, producing clips to review before
// promoting (TRIM replaces the video's file; SPLIT segments become new,
// disabled videos) or discarding.

import type { ApiEnvelope } from '#shared/types'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export type ClipOperation = 'TRIM' | 'SPLIT'

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
  createdAt: string
  expiresAt: string
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

  async function promote(videoId: number, clipId: number) {
    return (await api<ApiEnvelope<PromoteResult>>(`${base(videoId)}/${clipId}/promote`, { method: 'POST' })).data
  }

  async function remove(videoId: number, clipId: number) {
    await api(`${base(videoId)}/${clipId}`, { method: 'DELETE' })
  }

  return { overview, startTrim, startSplit, promote, remove }
}
