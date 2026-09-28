// The signed-in user's viewing preferences, saved on the server
// (/api/me/preferences) so they follow them to any device. Loaded once per
// session and shared by every page; changes are saved shortly after they're made.

import type { ApiEnvelope } from '#shared/types'

export type CaptionSize = 's' | 'm' | 'l' | 'xl'
export type CaptionFont = 'sans' | 'serif' | 'rounded'
export type PracticeMode = 'normal' | 'hover' | 'reveal' | 'translation'

export interface CaptionStyle {
  size: CaptionSize
  /** Background darkness behind the text, 0–100. */
  background: number
  font: CaptionFont
  /** Where captions sit on the picture — top keeps clear of subtitles burned into the video. */
  position: 'bottom' | 'top'
  /** The second language's line: above or below the main one. */
  secondary: 'above' | 'below'
}

export interface LearnerPrefs {
  /** Subtitle languages to pick on every video (when it has them); 'off' = no subtitles. */
  primaryLanguage?: string | null
  secondaryLanguage?: string | null
  captionStyle: CaptionStyle
  practice: PracticeMode
  /** Pause while the pointer is over the captions (so words can be clicked). */
  hoverPause: boolean
  wordHighlight: boolean
  glossaryHighlight: boolean
  /** Timing correction per video id, in ms (positive = text shows later). */
  offsets: Record<string, number>
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { size: 'm', background: 70, font: 'sans', position: 'bottom', secondary: 'above' }
const DEFAULTS: LearnerPrefs = {
  captionStyle: DEFAULT_CAPTION_STYLE,
  practice: 'normal',
  hoverPause: true,
  wordHighlight: false,
  glossaryHighlight: true,
  offsets: {}
}
/** Older offsets are dropped past this many videos. */
const MAX_OFFSETS = 200
const SAVE_DELAY_MS = 800

export function useLearnerPrefs() {
  const prefs = useState<LearnerPrefs>('learner-prefs', () => structuredClone(DEFAULTS))
  const loaded = useState('learner-prefs-loaded', () => false)
  const api = useApi()

  async function load() {
    if (loaded.value || !import.meta.client) return
    loaded.value = true
    try {
      const saved = (await api<ApiEnvelope<Partial<LearnerPrefs>>>('/api/me/preferences')).data ?? {}
      prefs.value = {
        ...DEFAULTS,
        ...saved,
        captionStyle: { ...DEFAULT_CAPTION_STYLE, ...(saved.captionStyle ?? {}) },
        offsets: { ...(saved.offsets ?? {}) }
      }
    } catch {
      // Defaults it is — viewing works without saved preferences.
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  function save() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      api('/api/me/preferences', { method: 'PUT', body: prefs.value }).catch(() => {})
    }, SAVE_DELAY_MS)
  }

  function update(patch: Partial<LearnerPrefs>) {
    prefs.value = { ...prefs.value, ...patch }
    save()
  }

  function setStyle(patch: Partial<CaptionStyle>) {
    update({ captionStyle: { ...prefs.value.captionStyle, ...patch } })
  }

  function offsetFor(videoId: number | null | undefined) {
    return videoId == null ? 0 : (prefs.value.offsets[String(videoId)] ?? 0)
  }

  function setOffset(videoId: number, ms: number) {
    const offsets = { ...prefs.value.offsets }
    delete offsets[String(videoId)]
    if (ms) offsets[String(videoId)] = ms
    // Keep the newest (insertion order) few hundred.
    const keys = Object.keys(offsets)
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_OFFSETS))) delete offsets[k]
    update({ offsets })
  }

  return { prefs, load, update, setStyle, offsetFor, setOffset }
}
