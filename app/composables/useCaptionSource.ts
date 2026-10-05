// The video's transcripts, and their lines once asked for — for the Text tab's
// subtitles (picking a transcript, and the live preview over the player).
// Read once per video, only for users allowed to read transcripts.

import type { CaptionLine } from '#shared/utils/burnedCaptions'

export interface CaptionTranscript {
  id: number
  language: string
  segmentCount: number
}

export function useCaptionSource(videoId: () => number) {
  const { can } = useAuth()
  const { list, get } = useTranscripts()
  const allowed = computed(() => can('transcripts', 'READ'))
  const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const transcripts = ref<CaptionTranscript[]>([])
  const lines = reactive<Record<number, CaptionLine[]>>({})
  let loadedFor = 0

  async function load() {
    const id = videoId()
    if (!allowed.value || loadedFor === id) return
    loadedFor = id
    state.value = 'loading'
    try {
      const page = await list({ videoId: id, size: 50 })
      if (videoId() !== id) return
      transcripts.value = page.data.map((t) => ({ id: t.id, language: t.language, segmentCount: t.segmentCount }))
      state.value = 'ready'
    } catch {
      state.value = 'error'
      loadedFor = 0
    }
  }

  /** Reads a transcript's lines once; later calls use what was read. */
  async function ensureLines(transcriptId: number | null) {
    if (transcriptId == null || lines[transcriptId]) return
    try {
      lines[transcriptId] = ((await get(transcriptId)).segments ?? []).map((s) => ({ startMs: s.startMs, endMs: s.endMs, text: s.text }))
    } catch {
      // The preview just stays empty; the render reads the lines itself.
    }
  }

  watch(videoId, () => {
    transcripts.value = []
    for (const k of Object.keys(lines)) delete lines[Number(k)]
    state.value = 'idle'
    loadedFor = 0
  })

  return { allowed, state, transcripts, lines, load, ensureLines }
}

export type CaptionSource = ReturnType<typeof useCaptionSource>
