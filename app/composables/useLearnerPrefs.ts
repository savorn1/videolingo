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
  /**
   * Small data other features keep in the same synced document (study activity, saved presets…), one
   * key each. The whole document is capped at 32 KB on the server, so only small things belong here.
   */
  app?: Record<string, unknown>
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

// Shared by everything that uses the document: one read, and saving only once that read worked.
let inflight: Promise<void> | null = null

export function useLearnerPrefs() {
  const prefs = useState<LearnerPrefs>('learner-prefs', () => structuredClone(DEFAULTS))
  const loaded = useState('learner-prefs-loaded', () => false)
  /** The document was read from the server; until then nothing is written back, so defaults can't replace what is saved. */
  const readOk = useState('learner-prefs-read-ok', () => false)
  /** Whose document is in memory; when another account signs in during the same session, it starts over. */
  const owner = useState<string | null>('learner-prefs-owner', () => null)
  const { username } = useAuth()
  const api = useApi()

  function checkOwner() {
    const now = username.value ?? ''
    if (owner.value === now) return
    owner.value = now
    inflight = null
    loaded.value = false
    readOk.value = false
    prefs.value = structuredClone(DEFAULTS)
  }

  async function fetchPrefs() {
    loaded.value = true
    try {
      const saved = (await api<ApiEnvelope<Partial<LearnerPrefs>>>('/api/me/preferences')).data ?? {}
      prefs.value = {
        ...DEFAULTS,
        ...saved,
        captionStyle: { ...DEFAULT_CAPTION_STYLE, ...(saved.captionStyle ?? {}) },
        offsets: { ...(saved.offsets ?? {}) },
        app: { ...(saved.app ?? {}) }
      }
      readOk.value = true
    } catch {
      // Defaults it is — viewing works without saved preferences.
    }
  }

  /** Reads the document once per session; every caller gets the same promise, so they can wait for it. */
  function load(): Promise<void> {
    if (!import.meta.client) return Promise.resolve()
    checkOwner()
    if (!inflight) inflight = fetchPrefs()
    return inflight
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  function save() {
    clearTimeout(timer)
    const savingFor = username.value ?? ''
    timer = setTimeout(async () => {
      await load()
      // Not if the account changed in the meantime, or the document was never read.
      if (!readOk.value || (username.value ?? '') !== savingFor) return
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

  /** A value another feature keeps in the synced document, or `fallback` when it has none yet. */
  function appValue<T>(key: string, fallback: T): T {
    const value = prefs.value.app?.[key]
    return value === undefined ? fallback : (value as T)
  }

  function setApp(key: string, value: unknown) {
    update({ app: { ...(prefs.value.app ?? {}), [key]: value } })
  }

  return { prefs, load, update, setStyle, offsetFor, setOffset, appValue, setApp }
}
