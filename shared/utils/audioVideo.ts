import { spreadEvenly } from './slides'
// Making a video from a sound: the checks and small conversions the "Video from
// audio" page does before anything is uploaded. The server checks again.

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'] as const
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const
export const IMAGE_MAX_MB = 5

export const VIDEO_RESOLUTIONS = [
  { value: '360p', label: '360p', size: '640×360' },
  { value: '480p', label: '480p', size: '854×480' },
  { value: '720p', label: '720p', size: '1280×720' },
  { value: '1080p', label: '1080p', size: '1920×1080' }
] as const
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number]['value']
export const DEFAULT_RESOLUTION: VideoResolution = '720p'
export const DEFAULT_BACKGROUND = '#111827'

/** WIDE = 16:9, TALL = 9:16 (Shorts, Reels, TikTok), SQUARE = 1:1 — the resolution's height is the short side. */
export const VIDEO_SHAPES = [
  { value: 'WIDE', label: 'Wide', hint: '16:9 — YouTube, the web', icon: 'i-lucide-rectangle-horizontal' },
  { value: 'TALL', label: 'Tall', hint: '9:16 — Shorts, Reels, TikTok', icon: 'i-lucide-rectangle-vertical' },
  { value: 'SQUARE', label: 'Square', hint: '1:1 — feeds', icon: 'i-lucide-square' }
] as const
export type VideoShape = (typeof VIDEO_SHAPES)[number]['value']

/** "1280×720", "720×1280" or "720×720" for a resolution and shape (as the server builds the frame). */
export function frameSizeLabel(resolution: VideoResolution, shape: VideoShape): string {
  const [w, h] = (VIDEO_RESOLUTIONS.find((r) => r.value === resolution)?.size ?? '1280×720').split('×').map(Number) as [number, number]
  return shape === 'TALL' ? `${h}×${w}` : shape === 'SQUARE' ? `${h}×${h}` : `${w}×${h}`
}

/** How burned-in subtitles look and where they sit (mirrors OverlayRules.CAPTION_STYLES / CAPTION_POSITIONS). */
export const BURN_STYLES = [
  { value: 'CLASSIC', label: 'White, outlined' },
  { value: 'BOX', label: 'On a dark box' },
  { value: 'YELLOW', label: 'Yellow, outlined' }
] as const
export type BurnStyle = (typeof BURN_STYLES)[number]['value']
export type BurnPosition = 'BOTTOM' | 'TOP'

/** The waveform's height as % of the picture (mirrors AudioToVideoRules); left out, the style's usual height. */
export const MIN_WAVE_HEIGHT_PCT = 10
export const MAX_WAVE_HEIGHT_PCT = 80

/** The usual height: a quarter of the picture along the bottom (COLUMNS too), 40 % for the bars in the middle. */
export function defaultWaveHeight(style: string): number {
  return waveformPlacement(style) === 'CENTER' ? 40 : 25
}

/** The strip's text limit (mirrors AudioToVideoRules.MAX_STRIP). */
export const MAX_STRIP = 120

/** Chapters: parts of this many minutes (mirrors AudioToVideoRules). */
export const MIN_PART_MINUTES = 2
export const MAX_PART_MINUTES = 60

export const WAVEFORM_STYLES = [
  { value: 'NONE', label: 'None', hint: 'Just the picture' },
  { value: 'WAVES', label: 'Waveform', hint: 'A moving line' },
  { value: 'BARS', label: 'Bars', hint: 'Moving frequency bars' },
  { value: 'SPIKES', label: 'Spikes', hint: 'Sticks that grow and shrink with the sound' },
  { value: 'DOTS', label: 'Dots', hint: 'A trail of dots following the sound' },
  { value: 'SPECTRUM', label: 'Spectrum', hint: 'A thin line over the pitches' },
  { value: 'PULSE', label: 'Pulse', hint: 'Thin bars in the middle, mirrored up and down' },
  { value: 'BLOCKS', label: 'Blocks', hint: 'Thick bars in the middle, mirrored up and down' },
  { value: 'FINE', label: 'Fine', hint: 'Hair-thin bars, many of them, in the middle' },
  { value: 'STRIPES', label: 'Stripes', hint: 'Medium bars in the middle, mirrored up and down' },
  { value: 'REFLECT', label: 'Reflection', hint: 'Bars in the middle over a faded reflection' },
  { value: 'COLUMNS', label: 'Columns', hint: 'Bars rising from the bottom, like an equaliser' },
  { value: 'STEREO', label: 'Stereo', hint: 'The left and right channels as two bands (one for a mono recording)' }
] as const
export type WaveformStyle = (typeof WAVEFORM_STYLES)[number]['value']

const CENTERED_STYLES = ['PULSE', 'BLOCKS', 'FINE', 'STRIPES', 'REFLECT']

/** Where a style is drawn: the mirrored-bar styles (PULSE, BLOCKS, FINE, STRIPES, REFLECT) sit in the middle of the picture (mirrors the server), the rest along the bottom. */
export function waveformPlacement(style: string): 'CENTER' | 'BOTTOM' {
  return CENTERED_STYLES.includes(style) ? 'CENTER' : 'BOTTOM'
}

/** Most files made into videos in one go. */
export const MAX_BATCH = 20

export const BACKGROUND_SWATCHES = ['#111827', '#000000', '#ffffff', '#1e3a8a', '#065f46', '#7c2d12', '#581c87'] as const

interface FileLike {
  name: string
  type: string
  size: number
}

function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** A problem with the chosen sound, or null when it looks usable. */
export function audioFileProblem(file: FileLike, maxMb: number): string | null {
  const known = (AUDIO_EXTENSIONS as readonly string[]).includes(extension(file.name))
  if (!file.type.startsWith('audio/') && !known) return 'Choose an audio file: MP3, M4A, AAC, WAV, OGG, Opus or FLAC'
  if (file.size <= 0) return 'That file is empty'
  if (file.size > maxMb * 1024 * 1024) return `Audio files can be at most ${maxMb} MB`
  return null
}

/** A problem with the chosen cover picture, or null. */
export function coverFileProblem(file: FileLike): string | null {
  const known = (IMAGE_EXTENSIONS as readonly string[]).includes(extension(file.name))
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !known) return 'The cover must be a JPEG, PNG or WebP picture'
  if (file.size <= 0) return 'That file is empty'
  if (file.size > IMAGE_MAX_MB * 1024 * 1024) return `Pictures can be at most ${IMAGE_MAX_MB} MB`
  return null
}

/** Files dropped on the page, sorted: pictures (any image) go to the slideshow, everything else is tried as audio. */
export function sortDroppedFiles<F extends FileLike>(files: F[]): { audio: F[]; pictures: F[] } {
  const isPicture = (f: F) => f.type.startsWith('image/') || (IMAGE_EXTENSIONS as readonly string[]).includes(extension(f.name))
  return { audio: files.filter((f) => !isPicture(f)), pictures: files.filter(isPicture) }
}

/** Whether a colour is "#rrggbb", the only form the server accepts. */
export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

/** Reads a typed colour ("1a2b3c", "#1A2B3C") into "#1a2b3c", or null when it isn't one. */
export function normalizeHexColor(value: string): string | null {
  const hex = `#${value.trim().replace(/^#/, '')}`.toLowerCase()
  return isHexColor(hex) ? hex : null
}

/** A problem with making this many videos at once, or null. */
export function batchProblem(count: number): string | null {
  if (count > MAX_BATCH) return `At most ${MAX_BATCH} files at a time`
  return null
}

/** Titles made distinct for a batch: a repeat becomes "Lesson (2)", "Lesson (3)". Comparison ignores case. */
export function uniqueTitles(titles: string[]): string[] {
  const seen = new Map<string, number>()
  return titles.map((title) => {
    const key = title.trim().toLowerCase()
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n === 1 ? title : `${title.trim()} (${n})`
  })
}

/** Uploads running at once: enough to keep the line busy, few enough that each file still finishes early. */
export const PARALLEL_UPLOADS = 2

/** Which file should start uploading next: the first one waiting, or null when none is or `parallel` are already running. */
export function nextToUpload(statuses: ('queued' | 'uploading' | 'ready' | 'error')[], parallel = PARALLEL_UPLOADS): number | null {
  if (statuses.filter((s) => s === 'uploading').length >= parallel) return null
  const i = statuses.indexOf('queued')
  return i === -1 ? null : i
}

/** Whether a job's parameters (raw JSON) say it is a "video from audio" job. */
export function isAudioVideoJob(parameters: string | null | undefined): boolean {
  if (!parameters) return false
  try {
    return (JSON.parse(parameters) as { operation?: unknown }).operation === 'AUDIO_TO_VIDEO'
  } catch {
    return false
  }
}

/** The newest "video from audio" job among a video's jobs (any order), or null. */
export function findAudioVideoJob<T extends { id: number; parameters: string | null }>(jobs: T[]): T | null {
  const mine = jobs.filter((j) => isAudioVideoJob(j.parameters))
  return mine.length ? mine.reduce((a, b) => (b.id > a.id ? b : a)) : null
}

export type MakingOperation = 'AUDIO_TO_VIDEO' | 'MERGE'

/** Which "making a new video" operation a job's parameters (raw JSON) describe, or null for any other job. */
export function makingOperation(parameters: string | null | undefined): MakingOperation | null {
  if (!parameters) return null
  try {
    const operation = (JSON.parse(parameters) as { operation?: unknown } | null)?.operation
    return operation === 'AUDIO_TO_VIDEO' || operation === 'MERGE' ? operation : null
  } catch {
    return null
  }
}

/** The newest job that is making this video (from audio, or by joining others), or null. */
export function findMakingJob<T extends { id: number; parameters: string | null }>(jobs: T[]): (T & { operation: MakingOperation }) | null {
  let best: (T & { operation: MakingOperation }) | null = null
  for (const job of jobs) {
    const operation = makingOperation(job.parameters)
    if (operation && (!best || job.id > best.id)) best = { ...job, operation }
  }
  return best
}

/** The "look" settings worth remembering between visits to the page. */
export interface SavedLook {
  background: string
  resolution: VideoResolution
  waveform: WaveformStyle
  waveAuto: boolean
  waveColor: string
  normalize: boolean
  denoise: boolean
  shape: VideoShape
  motion: boolean
  crossfade: boolean
  trimSilence: boolean
  /** Null = the style's usual height. */
  waveHeightPct: number | null
}

export const DEFAULT_LOOK: SavedLook = {
  background: DEFAULT_BACKGROUND,
  resolution: DEFAULT_RESOLUTION,
  waveform: 'NONE',
  waveAuto: true,
  waveColor: '#ffffff',
  normalize: false,
  denoise: false,
  shape: 'WIDE',
  motion: false,
  crossfade: false,
  trimSilence: false,
  waveHeightPct: null
}

/** Settings read back from storage, made safe: anything missing or not valid falls back to the default. */
export function sanitizeLook(raw: unknown): SavedLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    background: normalizeHexColor(str(r.background)) ?? DEFAULT_LOOK.background,
    resolution: VIDEO_RESOLUTIONS.find((x) => x.value === r.resolution)?.value ?? DEFAULT_LOOK.resolution,
    waveform: WAVEFORM_STYLES.find((x) => x.value === r.waveform)?.value ?? DEFAULT_LOOK.waveform,
    waveAuto: typeof r.waveAuto === 'boolean' ? r.waveAuto : DEFAULT_LOOK.waveAuto,
    waveColor: normalizeHexColor(str(r.waveColor)) ?? DEFAULT_LOOK.waveColor,
    normalize: typeof r.normalize === 'boolean' ? r.normalize : DEFAULT_LOOK.normalize,
    denoise: typeof r.denoise === 'boolean' ? r.denoise : DEFAULT_LOOK.denoise,
    shape: VIDEO_SHAPES.find((x) => x.value === r.shape)?.value ?? DEFAULT_LOOK.shape,
    motion: typeof r.motion === 'boolean' ? r.motion : DEFAULT_LOOK.motion,
    crossfade: typeof r.crossfade === 'boolean' ? r.crossfade : DEFAULT_LOOK.crossfade,
    trimSilence: typeof r.trimSilence === 'boolean' ? r.trimSilence : DEFAULT_LOOK.trimSilence,
    waveHeightPct:
      typeof r.waveHeightPct === 'number' &&
      Number.isInteger(r.waveHeightPct) &&
      r.waveHeightPct >= MIN_WAVE_HEIGHT_PCT &&
      r.waveHeightPct <= MAX_WAVE_HEIGHT_PCT
        ? r.waveHeightPct
        : DEFAULT_LOOK.waveHeightPct
  }
}

/**
 * The pictures for one recording: its own picture (from its file's cover art, or chosen for it) on its own; else
 * the shared pictures, spread evenly over this recording's length when asked (and when it is long enough), else
 * at the times set.
 */
export function recordingSlides(
  shared: { key: string; startMs: number }[],
  ownKey: string | null,
  durationSeconds: number | null,
  spread: boolean
): { key: string; startMs: number }[] {
  if (ownKey) return [{ key: ownKey, startMs: 0 }]
  if (spread && shared.length > 1 && durationSeconds) {
    const starts = spreadEvenly(shared.length, durationSeconds)
    if (starts) return shared.map((sl, i) => ({ key: sl.key, startMs: starts[i]! }))
  }
  return shared.map((sl) => ({ key: sl.key, startMs: sl.startMs }))
}

/** Minutes per part as typed, kept within MIN_PART_MINUTES–MAX_PART_MINUTES (a blank or non-number falls back to 10). */
export function clampPartMinutes(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || value === '' || value === null) return 10
  return Math.min(MAX_PART_MINUTES, Math.max(MIN_PART_MINUTES, Math.round(n)))
}

/**
 * How many videos a recording will likely become when split into parts of `partMinutes`: as
 * AudioToVideoRules.chapterRanges cuts it with no pauses to move the cuts (a pause can change it by one).
 * Recordings up to 1.5 parts long, or of unknown length, stay one video.
 */
export function estimatedParts(durationSeconds: number | null, partMinutes: number): number {
  const part = partMinutes * 60
  if (!durationSeconds || part <= 0) return 1
  let from = 0
  let parts = 1
  while (durationSeconds - from > part * 1.5) {
    from += part
    parts++
  }
  return parts
}

/** "Lesson 4 — Part 2 of 3", the title kept within the 200-character limit. */
export function partTitle(title: string, index: number, count: number): string {
  const suffix = ` — Part ${index + 1} of ${count}`
  const base = title.trim() || 'Video'
  const room = 200 - suffix.length
  return (base.length > room ? `${base.slice(0, Math.max(0, room - 1))}…` : base) + suffix
}

/** What is stopping "Make the video" (in the order to fix it), or null when it can go ahead. */
export function submitBlocker(state: {
  files: number
  uploading: number
  untitled: number
  slideError: string | null
  missingCategory?: boolean
}): string | null {
  if (state.files === 0) return 'Add an audio file to begin'
  if (state.uploading > 0) return `Uploading ${state.uploading} file${state.uploading === 1 ? '' : 's'}…`
  if (state.untitled > 0) return state.untitled === 1 ? 'Give the video a title' : 'Give every video a title'
  if (state.slideError) return state.slideError
  if (state.missingCategory) return 'Choose a category under Details'
  return null
}

/** Which step of the form holds what submitBlocker reports (checked in the same order): 1 the audio, 2 the look, 4 the details. */
export function submitBlockerStep(state: {
  files: number
  audioUploading: number
  picturesUploading: boolean
  untitled: number
  slideError: string | null
  missingCategory?: boolean
}): 1 | 2 | 4 | null {
  if (state.files === 0 || state.audioUploading > 0) return 1
  if (state.picturesUploading) return 2
  if (state.untitled > 0) return 1
  if (state.slideError) return 2
  if (state.missingCategory) return 4
  return null
}

/** What a list row says about a video that is still being made: "Joining videos · 40%", "Making from audio · #2 in queue". */
export function makingLabel(operation: MakingOperation, status: string, progress: number, queuePosition: number | null): string {
  const what = operation === 'MERGE' ? 'Joining videos' : 'Making from audio'
  if (status === 'QUEUED') return queuePosition ? `${what} · #${queuePosition} in queue` : `${what} · waiting`
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  return `${what} · ${pct}%`
}

/** Video ids that were being made last time and aren't any more: their file has changed, so a list showing them is out of date. */
export function finishedMaking(before: Iterable<number>, now: Set<number>): number[] {
  return [...before].filter((id) => !now.has(id))
}
