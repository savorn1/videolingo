// Export presets saved in this browser ("Export for" on the editor's Trim tab):
// a crop shape and output size, next to the four built into the editor. Not
// per video, so a setup made once is there for every video.

import { addEntry, removeEntry, type NamedEntry } from '#shared/utils/namedList'
import { sanitizePresets, type ExportPresetData } from '#shared/utils/exportPreset'

const STORAGE_KEY = 'videolingo:export-presets'
export type SavedExportPreset = NamedEntry<ExportPresetData>

function read(): SavedExportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizePresets(JSON.parse(raw)) : []
  } catch {
    return []
  }
}
function write(list: SavedExportPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Private mode / storage full: presets just won't persist this session.
  }
}

export function useExportPresets() {
  const saved = ref<SavedExportPreset[]>([])
  onMounted(() => (saved.value = read()))

  function save(name: string, data: ExportPresetData) {
    saved.value = addEntry(saved.value, name, data)
    write(saved.value)
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    write(saved.value)
  }

  return { saved, save, remove }
}
