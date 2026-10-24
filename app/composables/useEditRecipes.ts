// Saved edit recipes (the "Recipes" menu in the editor's header): a crop shape and
// size, sound settings and text layers, kept in this browser so a look made on one
// video can be applied to the next. See shared/utils/editRecipe.ts for what is kept.

import { addEntry, removeEntry, renameEntry } from '#shared/utils/namedList'
import { recipesFileJson, recipesFromFile, sanitizeRecipes, type EditRecipe, type SavedRecipe } from '#shared/utils/editRecipe'

const STORAGE_KEY = 'videolingo:edit-recipes'

function read(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitizeRecipes(JSON.parse(raw)) : []
  } catch {
    return []
  }
}
function write(list: SavedRecipe[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Private mode / storage full: recipes just won't persist this session.
  }
}

export function useEditRecipes() {
  const saved = ref<SavedRecipe[]>([])
  onMounted(() => {
    saved.value = read()
  })

  function save(name: string, data: EditRecipe) {
    saved.value = addEntry(saved.value, name, data)
    write(saved.value)
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    write(saved.value)
  }
  function rename(id: string, name: string) {
    saved.value = renameEntry(saved.value, id, name)
    write(saved.value)
  }

  /** The saved recipes as a JSON file's text, to share or keep. */
  function exportJson(): string {
    return recipesFileJson(saved.value)
  }
  /** Adds the recipes in a file made by exportJson; ones already here (same name and settings) are skipped. Returns how many were added; throws on a file that has none. */
  function importJson(text: string): number {
    let added = 0
    for (const e of [...recipesFromFile(text)].reverse()) {
      if (saved.value.some((s) => s.name === e.name && JSON.stringify(s.data) === JSON.stringify(e.data))) continue
      saved.value = addEntry(saved.value, e.name, e.data)
      added++
    }
    if (added) write(saved.value)
    return added
  }

  return { saved, save, remove, rename, exportJson, importJson }
}
