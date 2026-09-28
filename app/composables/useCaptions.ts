// Subtitles for a learner player (watch page and collection player): picks
// tracks by the learner's remembered languages, loads their cues, applies the
// learner's timing correction for the video, and fetches glossary terms to
// underline. Track choices made here are remembered as the new languages.

import type { GlossaryTermRule } from '#shared/utils/glossary'
import type { LearnCue, LearnTrack } from './useLearn'

export const NO_TRACK = 0

export function useCaptions(source: { videoId: Ref<number | null>; videoLanguage: Ref<string | null>; tracks: Ref<LearnTrack[]> }) {
  const { cues: getCues, glossary } = useLearn()
  const { prefs, load: loadPrefs, update, offsetFor, setOffset } = useLearnerPrefs()

  const trackId = ref<number>(NO_TRACK)
  const secondId = ref<number>(NO_TRACK)
  const primaryTrack = computed(() => source.tracks.value.find((t) => t.id === trackId.value) ?? null)
  const secondTrack = computed(() => source.tracks.value.find((t) => t.id === secondId.value) ?? null)

  const trackOptions = computed(() => [
    { label: source.tracks.value.length ? 'No subtitles' : 'No subtitles yet', value: NO_TRACK },
    ...source.tracks.value.map((t) => ({ label: t.label, value: t.id }))
  ])
  const secondOptions = computed(() => [
    { label: 'No second language', value: NO_TRACK },
    ...source.tracks.value.filter((t) => t.id !== trackId.value).map((t) => ({ label: `Also: ${t.label}`, value: t.id }))
  ])

  // ── Choosing tracks ─────────────────────────────────────────────────────
  // Picking by language: the remembered one, else the default track, else
  // the video's own language, else the first.
  let choosing = false
  function chooseTracks() {
    const tracks = source.tracks.value
    const byLang = (lang?: string | null) => (lang ? tracks.find((t) => t.language === lang) : undefined)
    choosing = true
    const p = prefs.value.primaryLanguage
    const primary = p === 'off' ? undefined : (byLang(p) ?? tracks.find((t) => t.isDefault) ?? byLang(source.videoLanguage.value) ?? tracks[0])
    trackId.value = primary?.id ?? NO_TRACK
    const second = byLang(prefs.value.secondaryLanguage)
    secondId.value = second && second.id !== trackId.value ? second.id : NO_TRACK
    nextTick(() => (choosing = false))
  }
  watch(source.tracks, chooseTracks)

  // The learner's own choices become the remembered languages.
  watch(trackId, (id, previous) => {
    // Picking the second language as the main one swaps the two.
    if (secondId.value === id && id !== NO_TRACK) secondId.value = previous ?? NO_TRACK
    if (!choosing) update({ primaryLanguage: id === NO_TRACK ? 'off' : (primaryTrack.value?.language ?? null) })
  })
  watch(secondId, (id) => {
    if (!choosing) update({ secondaryLanguage: id === NO_TRACK ? null : (secondTrack.value?.language ?? null) })
  })

  /** S: next track, then off, then round again. */
  function cycleTrack() {
    const ids = [...source.tracks.value.map((t) => t.id), NO_TRACK]
    trackId.value = ids[(ids.indexOf(trackId.value) + 1) % ids.length]!
  }

  /** T: the second language on / off (back on = the remembered one, else the first other track). */
  let lastSecond = NO_TRACK
  function toggleSecond() {
    if (secondId.value !== NO_TRACK) {
      lastSecond = secondId.value
      secondId.value = NO_TRACK
      return
    }
    const others = source.tracks.value.filter((t) => t.id !== trackId.value)
    const pick = others.find((t) => t.id === lastSecond) ?? others.find((t) => t.language === prefs.value.secondaryLanguage) ?? others[0]
    if (pick) secondId.value = pick.id
  }

  // ── Cues (shifted by the learner's timing correction) ───────────────────
  const cache = new Map<number, LearnCue[]>()
  const rawPrimary = ref<LearnCue[]>([])
  const rawSecondary = ref<LearnCue[]>([])
  async function cuesOf(id: number) {
    if (id === NO_TRACK) return []
    if (!cache.has(id)) cache.set(id, await getCues(id).catch(() => []))
    return cache.get(id)!
  }
  watch(trackId, async (id) => (rawPrimary.value = await cuesOf(id)))
  watch(secondId, async (id) => (rawSecondary.value = await cuesOf(id)))

  const offsetMs = computed(() => offsetFor(source.videoId.value))
  const primaryCues = computed(() => shiftCues(rawPrimary.value, offsetMs.value))
  const secondaryCues = computed(() => shiftCues(rawSecondary.value, offsetMs.value))

  const OFFSET_STEP = 250
  const OFFSET_LIMIT = 10_000
  function nudge(deltaMs: number) {
    if (source.videoId.value == null) return
    setOffset(source.videoId.value, Math.max(-OFFSET_LIMIT, Math.min(OFFSET_LIMIT, offsetMs.value + deltaMs)))
  }
  function resetOffset() {
    if (source.videoId.value != null) setOffset(source.videoId.value, 0)
  }

  // ── Glossary terms: from the caption's language into the second one ─────
  const glossaryTerms = ref<GlossaryTermRule[]>([])
  watch(
    () => [primaryTrack.value?.language, secondTrack.value?.language, prefs.value.glossaryHighlight] as const,
    async ([from, to, on]) => {
      glossaryTerms.value = []
      if (!on || !from || !to || from === to) return
      glossaryTerms.value = await glossary(from, to).catch(() => [])
    }
  )

  onMounted(async () => {
    await loadPrefs()
    if (source.tracks.value.length) chooseTracks()
  })

  return {
    prefs,
    trackId,
    secondId,
    primaryTrack,
    secondTrack,
    trackOptions,
    secondOptions,
    primaryCues,
    secondaryCues,
    offsetMs,
    OFFSET_STEP,
    nudge,
    resetOffset,
    cycleTrack,
    toggleSecond,
    glossaryTerms
  }
}
