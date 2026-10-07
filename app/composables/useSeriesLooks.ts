// Whole "Video from audio" looks saved under a name (shared/utils/seriesLook.ts), kept in this browser.

import { addEntry, removeEntry } from '#shared/utils/namedList'
import { sanitizeSeriesLooks, type SeriesLook } from '#shared/utils/seriesLook'

const STORAGE_KEY = 'videolingo:series-looks'

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeSeriesLooks(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function useSeriesLooks() {
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
  /** Saves under `name` (a taken name gets "(2)"); returns the name used. */
  function save(name: string, look: SeriesLook) {
    saved.value = addEntry(saved.value, name, look)
    persist()
    return saved.value[0]?.name ?? name
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    persist()
  }

  return { saved, save, remove }
}
