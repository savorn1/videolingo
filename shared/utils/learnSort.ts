// How the learner's video list can be ordered. The values are what goes in the
// page's address (?sort=title), so a sorted view can be shared or refreshed; the
// columns are ones the server allows sorting by.

export const LEARN_SORTS = [
  { value: 'newest', label: 'Newest first', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'oldest', label: 'Oldest first', sortBy: 'createdAt', sortOrder: 'asc' },
  { value: 'title', label: 'Title A–Z', sortBy: 'title', sortOrder: 'asc' },
  { value: 'shortest', label: 'Shortest first', sortBy: 'durationSeconds', sortOrder: 'asc' },
  { value: 'longest', label: 'Longest first', sortBy: 'durationSeconds', sortOrder: 'desc' }
] as const

export type LearnSort = (typeof LEARN_SORTS)[number]['value']
export const DEFAULT_LEARN_SORT: LearnSort = 'newest'

/** A sort read from the address or storage, or the default when it isn't one of ours. */
export function normalizeSort(raw: unknown): LearnSort {
  return LEARN_SORTS.find((s) => s.value === raw)?.value ?? DEFAULT_LEARN_SORT
}

/** The column and direction to ask the server for. */
export function sortParams(value: unknown): { sortBy: string; sortOrder: 'asc' | 'desc' } {
  const sort = LEARN_SORTS.find((s) => s.value === value) ?? LEARN_SORTS[0]
  return { sortBy: sort.sortBy, sortOrder: sort.sortOrder }
}
