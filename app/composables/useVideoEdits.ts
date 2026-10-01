// Wraps the backend's VideoEditController (/api/admin/videos/{id}/edits),
// gated as module "videos": GET = READ, the rest = WRITE. Trim/crop, split,
// audio edits and audio extracts all run as EDIT processing jobs, producing
// clips to review before promoting (TRIM and AUDIO replace the video's file;
// SPLIT segments become new, disabled videos), downloading (EXTRACT) or
// discarding.

import type { ApiEnvelope } from '#shared/types'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export type ClipOperation = 'TRIM' | 'SPLIT' | 'AUDIO' | 'EXTRACT' | 'OVERLAY'

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

/** A text or image layer drawn over the video; x/y is its centre as fractions of the frame. */
export interface OverlayLayer {
  kind: 'TEXT' | 'IMAGE'
  text: string | null
  font: string | null
  /** CSS-style, 100–900. */
  weight: number
  /** Font size as % of the video's height. */
  sizePct: number
  color: string | null
  /** Null = no box behind the text. */
  background: string | null
  backgroundOpacity: number
  align: 'LEFT' | 'CENTER' | 'RIGHT' | null
  /** An uploaded file (kind OVERLAY). */
  imageKey: string | null
  /** Image width as % of the video's width. */
  widthPct: number
  x: number
  y: number
  opacity: number
  startMs: number
  /** Null = to the end. */
  endMs: number | null
  animation: 'NONE' | 'FADE' | 'SLIDE_UP' | 'SLIDE_LEFT'
}

export interface Waveform {
  durationMs: number
  /** Loudest level (0–1) in each equal slice of the sound. */
  peaks: number[]
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

  async function startTrim(
    videoId: number,
    body: {
      startMs: number
      endMs?: number | null
      crop?: CropRect | null
      scale?: ScaleSize | null
      rotate?: 90 | 180 | 270
      flipH?: boolean
      flipV?: boolean
    }
  ) {
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

  async function startOverlay(videoId: number, layers: OverlayLayer[]) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/overlay`, { method: 'POST', body: { layers } })).data
  }

  /** Font families the server can draw text with. */
  async function fonts(videoId: number) {
    return (await api<ApiEnvelope<string[]>>(`${base(videoId)}/fonts`)).data
  }

  /** A crop box (w/h = `aspect`) centred on wherever the video moves the most — for "Auto-center". */
  async function autoCrop(videoId: number, aspect: number) {
    return (await api<ApiEnvelope<CropRect>>(`${base(videoId)}/auto-crop?aspect=${aspect}`)).data
  }

  /** The video's sound (or an uploaded audio file's) as peaks, for drawing a waveform. */
  async function waveform(videoId: number, options: { key?: string | null; points?: number } = {}) {
    const query = new URLSearchParams({ points: String(options.points ?? 2000) })
    if (options.key) query.set('key', options.key)
    return (await api<ApiEnvelope<Waveform>>(`${base(videoId)}/waveform?${query}`)).data
  }

  /** Applies a result. With `asNew`, a trim / audio / overlay result becomes a separate video instead of replacing the original. */
  async function promote(videoId: number, clipId: number, options: { asNew?: boolean; title?: string } = {}) {
    const body = options.asNew ? { asNew: true, title: options.title?.trim() || undefined } : undefined
    return (await api<ApiEnvelope<PromoteResult>>(`${base(videoId)}/${clipId}/promote`, { method: 'POST', body })).data
  }

  async function remove(videoId: number, clipId: number) {
    await api(`${base(videoId)}/${clipId}`, { method: 'DELETE' })
  }

  return { overview, startTrim, startSplit, startAudio, startExtract, startOverlay, fonts, waveform, autoCrop, promote, remove }
}
