// Your own waveform looks ("Video from audio" → Moving waveform → Templates), kept in this
// browser next to the built-in ones in shared/utils/waveTemplates.ts.

import { addEntry, removeEntry } from '#shared/utils/namedList'
import { BUILTIN_WAVE_TEMPLATES, sanitizeWaveTemplates, type WaveLook } from '#shared/utils/waveTemplates'

const STORAGE_KEY = 'videolingo:wave-templates'

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeWaveTemplates(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function useWaveTemplates() {
  const saved = ref<ReturnType<typeof read>>([])
  onMounted(() => {
    saved.value = read()
  })

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.value))
    } catch {
      // Private mode / storage full: the look just won't be there next time.
    }
  }
  function save(name: string, look: WaveLook) {
    // A name taken by a built-in one gets "(2)" too, so the grid never shows two the same.
    saved.value = addEntry(saved.value, name, look)
    persist()
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    persist()
  }

  /** Built-in first, then yours. */
  const all = computed(() => [
    ...BUILTIN_WAVE_TEMPLATES.map((t) => ({ ...t, builtin: true as const })),
    ...saved.value.map((e) => ({ id: e.id, name: e.name, hint: 'Saved by you', look: e.data, builtin: false as const }))
  ])

  return { saved, all, save, remove }
}
