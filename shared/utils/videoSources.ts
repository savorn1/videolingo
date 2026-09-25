// Add Video helpers: which sources are supported, pulling a link out of
// pasted text, and small parsing/formatting bits the form needs. Platform
// detection itself happens on the server (VideoLinks); this only decides
// whether something is worth sending there.

export type VideoSourceKind = 'UPLOAD' | 'YOUTUBE' | 'VIMEO' | 'FACEBOOK' | 'URL'

export const VIDEO_SOURCES: { value: VideoSourceKind; label: string; icon: string; hint: string }[] = [
  { value: 'YOUTUBE', label: 'YouTube', icon: 'i-simple-icons-youtube', hint: 'Videos, Shorts and youtu.be links' },
  { value: 'VIMEO', label: 'Vimeo', icon: 'i-simple-icons-vimeo', hint: 'Public and unlisted videos' },
  { value: 'FACEBOOK', label: 'Facebook', icon: 'i-simple-icons-facebook', hint: 'Videos, Reels and fb.watch links' },
  { value: 'URL', label: 'Video file link', icon: 'i-lucide-file-video', hint: '.mp4, .webm, .mov… or a page with a video' },
  { value: 'UPLOAD', label: 'Upload', icon: 'i-lucide-upload', hint: 'A file from your computer' }
]

export function videoSourceMeta(source: string | null | undefined) {
  return VIDEO_SOURCES.find((s) => s.value === source) ?? VIDEO_SOURCES[3]!
}

/** Accepted upload extensions (mirrors the backend's VideoIngestService.VIDEO_TYPES). */
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'ogv', 'mkv']

export function isVideoFile(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('video/')) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_FILE_EXTENSIONS.includes(ext)
}

const KNOWN_HOSTS = /^(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|facebook\.com|fb\.watch)\//i

/**
 * The first link in pasted text — a full http(s) URL, or a bare known-platform
 * address such as "youtu.be/abc". Null when there isn't one.
 */
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null
  const full = text.match(/https?:\/\/[^\s<>"']+/i)
  if (full) return full[0].replace(/[),.;]+$/, '')
  for (const word of text.split(/\s+/)) {
    if (KNOWN_HOSTS.test(word)) return word.replace(/[),.;]+$/, '')
  }
  return null
}

/** Quick client-side check before asking the server; returns a reason, or null when it looks fine. */
export function linkProblem(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (/\s/.test(v)) return 'A link can’t contain spaces'
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return 'That doesn’t look like a link'
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Only http:// and https:// links are supported'
  if (!url.hostname.includes('.')) return 'That link has no valid website address'
  return null
}

/** "1:02:03", "12:05", "95" (seconds) → seconds; null when unreadable. */
export function parseDurationInput(value: string | null | undefined): number | null {
  const v = (value ?? '').trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return Number(v)
  const parts = v.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p) && !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some((n) => n >= 60)) return null
  return nums.reduce((total, n) => total * 60 + n, 0)
}

/** "lesson_01-ordering.coffee.mp4" → "Lesson 01 ordering coffee" (mirrors the backend). */
export function titleFromFileName(name: string): string {
  const base = name
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : ''
}
