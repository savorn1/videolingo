// Export presets ("Export for" on the editor's Trim tab): a crop shape and
// output size, next to the four built into the editor. Not per video, so a setup
// made once is there for every video. Kept in this browser and in the user's
// synced preferences (see useLearnerPrefs), so they follow them to another device.

import { addEntry, removeEntry, renameEntry, type NamedEntry } from '#shared/utils/namedList'
import { sanitizePresets, type ExportPresetData } from '#shared/utils/exportPreset'
import { mergeById, sameIds } from '#shared/utils/syncedList'

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

const SYNC_KEY = 'exportPresets'

export function useExportPresets() {
  const { load: loadPrefs, appValue, setApp } = useLearnerPrefs()
  const saved = ref<SavedExportPreset[]>([])

  onMounted(async () => {
    saved.value = read()
    // Bring the server copy and this browser's together: the server's first, then anything only this browser has.
    try {
      await loadPrefs()
      const server = sanitizePresets(appValue<unknown>(SYNC_KEY, []))
      const merged = mergeById(server, saved.value)
      if (!sameIds(merged, saved.value)) {
        saved.value = merged
        write(merged)
      }
      if (!sameIds(merged, server)) setApp(SYNC_KEY, merged)
    } catch {
      // Offline or signed out: this browser's copy is what there is.
    }
  })

  function commit() {
    write(saved.value)
    setApp(SYNC_KEY, saved.value)
  }

  function save(name: string, data: ExportPresetData) {
    saved.value = addEntry(saved.value, name, data)
    commit()
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    commit()
  }

  function rename(id: string, name: string) {
    saved.value = renameEntry(saved.value, id, name)
    commit()
  }

  /** The saved presets as a JSON file's text, to share or keep. */
  function exportJson(): string {
    return JSON.stringify({ kind: 'videolingo-export-presets', version: 1, presets: saved.value }, null, 2)
  }
  /** Adds the presets in a file made by exportJson. Ones already here (same name and size) are skipped. Returns how many were added; throws on a file that isn't presets. */
  function importJson(text: string): number {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('That file is not valid JSON.')
    }
    const incoming = sanitizePresets(Array.isArray(parsed) ? parsed : (parsed as { presets?: unknown } | null)?.presets)
    if (!incoming.length) throw new Error('No export presets found in that file.')
    let added = 0
    for (const e of [...incoming].reverse()) {
      const dupe = saved.value.some((s) => s.name === e.name && s.data.aspect === e.data.aspect && s.data.w === e.data.w && s.data.h === e.data.h)
      if (dupe) continue
      saved.value = addEntry(saved.value, e.name, e.data)
      added++
    }
    if (added) commit()
    return added
  }

  return { saved, save, remove, rename, exportJson, importJson }
}
