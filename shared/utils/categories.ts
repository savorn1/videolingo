// The category catalog (GET /api/categories), loaded by the categories plugin
// at startup and again after any admin change, so category pickers and badges
// everywhere stay current. Reactive, like the language catalog.
//
// Keep exported object literals multi-line here: the auto-import scanner
// misreads one-line `export const X = { a: 1, b: 2 }` and drops later exports.

import { shallowRef } from 'vue'

export interface CatalogCategory {
  id: number
  name: string
  slug: string
  color: string | null
  sortOrder: number
  enabled: boolean
}

/** Palette names a category can use (mirrors the backend CategoryRequest pattern). */
export const CATEGORY_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
] as const

const catalog = shallowRef<CatalogCategory[]>([])

export function setCategoryCatalog(categories: CatalogCategory[]) {
  catalog.value = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export function categoryCatalog(): CatalogCategory[] {
  return catalog.value
}

export function categoryById(id: number): CatalogCategory | undefined {
  return catalog.value.find((c) => c.id === id)
}

/**
 * Picker options: every enabled category, plus any of `currentIds` that are
 * disabled (marked so) — a video keeps categories that were disabled after
 * it was filed, and the picker must not silently drop them.
 */
export function categoryOptions(currentIds: number[] = []): { label: string; value: number; disabled?: boolean }[] {
  return catalog.value.filter((c) => c.enabled || currentIds.includes(c.id)).map((c) => ({ label: c.enabled ? c.name : `${c.name} (disabled)`, value: c.id }))
}
