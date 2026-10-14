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

/** A result on the Edit results page: the video it was made from, and the result. */
export interface EditResultRow {
  videoId: number
  videoTitle: string | null
  videoDeleted: boolean
  clip: VideoClip
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
  /** 0.5–2; the picture follows (and the sound too, unless keepSoundSpeed). */
  speed?: number
  /** -12…12 */
  pitchSemitones?: number
  /** -1 (left) … 1 (right) */
  balance?: number
  channels?: 'KEEP' | 'MONO' | 'STEREO'
  music?: { key: string; volume: number; loop: boolean; duck: boolean; startMs: number } | null
  /** More sound beds besides the music (effects, a second bed), mixed the same way; up to 4. */
  tracks?: { key: string; volume: number; loop: boolean; duck: boolean; startMs: number }[]
  /** With a speed change: re-time only the picture, the sound plays at its own speed (padded or cut at the end). */
  keepSoundSpeed?: boolean
  /** Levels at points of the video's timeline (0–2), a straight line between; up to 30 points. */
  volumeCurve?: { atMs: number; gain: number }[]
  /** A ready-made sound shape for the main sound. */
  preset?: 'NONE' | 'MORE_BASS' | 'CLEARER_VOICE' | 'PHONE' | 'RADIO'
  /** Tame harsh "s" sounds. */
  deEss?: boolean
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
  /** Moves over its time to here (centre, 0–1) and/or grows to toScale × its size; left out = stays put. */
  toX?: number | null
  toY?: number | null
  toScale?: number | null
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
      /** Let `endMs` run past the end of the video (up to MAX_EXTEND_MS): the last frame is held, the sound is silent. */
      extend?: boolean
      /** A picture look (brightness, contrast, colour, blur, tint, vignette); leave out for none. */
      look?: {
        brightness: number
        contrast: number
        saturation: number
        blur: number
        grayscale: boolean
        sepia: boolean
        vignette: boolean
        warmth: number
        sharpen: boolean
      } | null
      /** Sound added to the trimmed result: music mixed in, or a file used instead of the video's own sound. */
      audio?: { replaceKey?: string; music?: { key: string; volume: number; loop: boolean; duck: boolean; startMs: number } } | null
      /** Motion & effects (shared/utils/videoMotion.ts); times on the trimmed clip. */
      effect?: string
      fade?: { inMs: number; outMs: number; color: 'BLACK' | 'WHITE' }
      freeze?: { atMs: number; durationMs: number }
      /** Pauses on the last frame, e.g. after each sentence (in time order, ≥ 0.5 s apart). */
      holds?: { atMs: number; durationMs: number }[]
      speed?: { startMs: number; endMs: number; speed: number }
      /** Several parts at another speed (in time order, not overlapping); newer servers take these instead of `speed`. */
      speeds?: { startMs: number; endMs: number; speed: number }[]
      reverse?: boolean
      stabilize?: boolean
      zoomTo?: { cx: number; cy: number; size: number }
      greenScreen?: { keyColor: string; similarity: number; background: string }
      /** Follow the action: a crop of this shape (w/h) that moves with the motion, instead of `crop`. */
      reframe?: { aspect: number }
      /** Blur, picture in picture & cards (shared/utils/trimExtras.ts). */
      blurs?: { x: number; y: number; w: number; h: number }[]
      pip?: { videoId: number; corner: string; sizePct: number }
      cards?: {
        intro: { text: string; durationMs: number } | null
        outro: { text: string; durationMs: number } | null
        background: string
        color: string
        logoKey: string | null
      }
    }
  ) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/trim`, { method: 'POST', body })).data
  }

  async function startSplit(videoId: number, segments: SegmentRange[]) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/split`, { method: 'POST', body: { segments } })).data
  }

  /** Takes the given ranges out of the video; what is left plays on as one video (a TRIM-style result). */
  async function startCut(videoId: number, cuts: { startMs: number; endMs: number }[]) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/cut`, { method: 'POST', body: { cuts } })).data
  }

  async function startAudio(videoId: number, body: AudioEditRequest) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/audio`, { method: 'POST', body })).data
  }

  async function startExtract(videoId: number, format: 'MP3' | 'WAV') {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/extract-audio`, { method: 'POST', body: { format } })).data
  }

  /** Layers and/or subtitles burned in from a transcript of the video. */
  async function startOverlay(
    videoId: number,
    layers: OverlayLayer[],
    captions?: {
      transcriptId: number
      secondTranscriptId: number | null
      style: string
      position: string
      sizePct: number
      look?: { color: string; secondColor: string; edgeColor: string; box: boolean; boxOpacity: number; bold: boolean } | null
    } | null
  ) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base(videoId)}/overlay`, { method: 'POST', body: { layers, captions: captions ?? null } })).data
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
  /** Speaks a line with the text-to-speech service and keeps it as an audio upload (backend NarrationRules). */
  async function narrate(videoId: number, body: { text: string; voice: string; rate: number }) {
    return (await api<ApiEnvelope<{ key: string; durationMs: number }>>(`${base(videoId)}/narration`, { method: 'POST', body })).data
  }

  /** The quiet stretches in the video's sound, quieter than `noiseDb` (backend PauseRules), for "Remove the pauses". */
  async function pauses(videoId: number, noiseDb: number) {
    return (await api<ApiEnvelope<{ durationMs: number; pauses: { startMs: number; endMs: number }[] }>>(`${base(videoId)}/pauses?noiseDb=${noiseDb}`)).data
  }

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

  /** Every edit result still kept, across all videos, newest first (at most 200). */
  async function allResults() {
    return (await api<ApiEnvelope<EditResultRow[]>>('/api/admin/videos/edit-results')).data
  }

  return {
    overview,
    startTrim,
    startSplit,
    startCut,
    startAudio,
    startExtract,
    startOverlay,
    fonts,
    waveform,
    pauses,
    narrate,
    autoCrop,
    promote,
    remove,
    allResults
  }
}
