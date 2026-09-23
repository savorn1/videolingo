// The language catalog: which languages exist, their names, and which are
// enabled / the default. Source of truth is the backend's Languages table
// (GET /api/languages, loaded by the languages plugin at startup and again
// after any admin change). Until that arrives, FALLBACK_LANGUAGES — the same
// starter set the backend seeds — keeps labels from flashing raw codes.
//
// Reactive on purpose: every languageLabel()/languageOptions() call in a
// template re-renders when the catalog loads or changes.

import { shallowRef } from 'vue'

export interface CatalogLanguage {
  code: string
  name: string
  nativeName?: string | null
  enabled: boolean
  isDefault: boolean
}

export const FALLBACK_LANGUAGES: CatalogLanguage[] = [
  ['en', 'English'],
  ['km', 'Khmer'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['th', 'Thai'],
  ['vi', 'Vietnamese'],
  ['fr', 'French'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['ar', 'Arabic'],
  ['hi', 'Hindi'],
  ['id', 'Indonesian']
].map(([code, name]) => ({ code: code!, name: name!, enabled: true, isDefault: code === 'en' }))

const catalog = shallowRef<CatalogLanguage[]>(FALLBACK_LANGUAGES)

export function setLanguageCatalog(languages: CatalogLanguage[]) {
  catalog.value = [...languages].sort((a, b) => a.name.localeCompare(b.name))
}

export function languageCatalog(): CatalogLanguage[] {
  return catalog.value
}

function find(code: string | null | undefined): CatalogLanguage | undefined {
  if (!code) return undefined
  const lower = code.toLowerCase()
  return catalog.value.find((l) => l.code.toLowerCase() === lower)
}

/** "Japanese"; the raw code upper-cased for a code the catalog doesn't know. */
export function languageLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return find(code)?.name ?? code.toUpperCase()
}

/** The default language's code, e.g. for pre-filling a new record. */
export function defaultLanguageCode(): string | undefined {
  return catalog.value.find((l) => l.isDefault)?.code
}

/**
 * Picker options: every enabled language. `current` is always included —
 * marked "(disabled)" or shown by code if it's disabled or unknown — so
 * editing a record never silently drops the language it already has.
 */
export function languageOptions(current?: string | null): { label: string; value: string | undefined }[] {
  const options: { label: string; value: string | undefined }[] = catalog.value.filter((l) => l.enabled).map((l) => ({ label: l.name, value: l.code }))
  if (current && !options.some((o) => o.value?.toLowerCase() === current.toLowerCase())) {
    const known = find(current)
    options.push({ label: known ? `${known.name} (disabled)` : current.toUpperCase(), value: known?.code ?? current })
  }
  return options
}
