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
