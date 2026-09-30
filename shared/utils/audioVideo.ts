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

export const WAVEFORM_STYLES = [
  { value: 'NONE', label: 'None', hint: 'Just the picture' },
  { value: 'WAVES', label: 'Waveform', hint: 'A moving line' },
  { value: 'BARS', label: 'Bars', hint: 'Moving frequency bars' }
] as const
export type WaveformStyle = (typeof WAVEFORM_STYLES)[number]['value']

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

/** Which of `sizes` (bytes) should upload next: the first one not yet started, or null. Uploads run one at a time. */
export function nextToUpload(statuses: ('queued' | 'uploading' | 'ready' | 'error')[]): number | null {
  if (statuses.includes('uploading')) return null
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
}

export const DEFAULT_LOOK: SavedLook = {
  background: DEFAULT_BACKGROUND,
  resolution: DEFAULT_RESOLUTION,
  waveform: 'NONE',
  waveAuto: true,
  waveColor: '#ffffff',
  normalize: false,
  denoise: false
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
    denoise: typeof r.denoise === 'boolean' ? r.denoise : DEFAULT_LOOK.denoise
  }
}

/** What is stopping "Make the video" (in the order to fix it), or null when it can go ahead. */
export function submitBlocker(state: { files: number; uploading: number; untitled: number; slideError: string | null }): string | null {
  if (state.files === 0) return 'Add an audio file to begin'
  if (state.uploading > 0) return `Uploading ${state.uploading} file${state.uploading === 1 ? '' : 's'}…`
  if (state.untitled > 0) return state.untitled === 1 ? 'Give the video a title' : 'Give every video a title'
  if (state.slideError) return state.slideError
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
