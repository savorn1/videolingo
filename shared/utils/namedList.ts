// A small named list kept in the browser (overlay templates today) — add,
// rename, remove, with a cap and de-duplicated names. Storage-agnostic and
// generic over the saved payload, so it's pure and easy to test; the
// composable that owns it just reads/writes localStorage around these calls.

export interface NamedEntry<T> {
  id: string
  name: string
  savedAt: number
  data: T
}

export const MAX_NAMED_ENTRIES = 30

let seq = 0
export function newEntryId(): string {
  seq += 1
  return `n${Date.now().toString(36)}${seq}`
}

/** "Title", "Title (2)", "Title (3)"… against the names already taken. */
export function uniqueName(wanted: string, taken: string[]): string {
  const base = wanted.trim() || 'Untitled'
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base} (${n})`)) n++
  return `${base} (${n})`
}

/** Adds an entry (or overwrites `replaceId`'s data/name if given), newest first, capped. */
export function addEntry<T>(list: NamedEntry<T>[], name: string, data: T, replaceId?: string | null, limit = MAX_NAMED_ENTRIES): NamedEntry<T>[] {
  if (replaceId) {
    const existing = list.find((e) => e.id === replaceId)
    if (existing) {
      return list.map((e) => (e.id === replaceId ? { ...e, name: uniqueName(name, others(list, replaceId)), data, savedAt: Date.now() } : e))
    }
  }
  const entry: NamedEntry<T> = {
    id: newEntryId(),
    name: uniqueName(
      name,
      list.map((e) => e.name)
    ),
    data,
    savedAt: Date.now()
  }
  return [entry, ...list].slice(0, limit)
}

export function removeEntry<T>(list: NamedEntry<T>[], id: string): NamedEntry<T>[] {
  return list.filter((e) => e.id !== id)
}

export function renameEntry<T>(list: NamedEntry<T>[], id: string, name: string): NamedEntry<T>[] {
  return list.map((e) => (e.id === id ? { ...e, name: uniqueName(name, others(list, id)) } : e))
}

function others<T>(list: NamedEntry<T>[], id: string): string[] {
  return list.filter((e) => e.id !== id).map((e) => e.name)
}
