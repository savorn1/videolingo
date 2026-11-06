// RuengFlix's home page rows (RuengFlix › Home rows): where a row's series come from, and the checks the backend
// repeats (StreamingHomeRowsService.valid).
import { SERIES_CATEGORIES, type SeriesCategory } from './streamingSeries'

export type HomeRowSource = 'LATEST' | 'POPULAR' | 'CATEGORY' | 'GENRE'

export const HOME_ROW_SOURCES: { value: HomeRowSource; label: string }[] = [
  { value: 'LATEST', label: 'Newest updates' },
  { value: 'POPULAR', label: 'Popular now' },
  { value: 'CATEGORY', label: 'One category' },
  { value: 'GENRE', label: 'One genre' }
]

export const MAX_HOME_ROWS = 20
export const HOME_ROW_ITEMS = { min: 4, max: 30 }
export const MAX_HOME_ROW_TITLE = 80

export interface HomeRowForm {
  title: string
  source: HomeRowSource
  /** The category for CATEGORY, the genre for GENRE */
  category: SeriesCategory
  genre: string
  maxItems: number
  active: boolean
}

/** What's wrong with the form, in words, or null when it can be saved. */
export function homeRowProblem(f: HomeRowForm): string | null {
  const title = f.title.trim()
  if (!title) return 'Give the row a heading'
  if (title.length > MAX_HOME_ROW_TITLE) return `Keep the heading to ${MAX_HOME_ROW_TITLE} characters`
  if (f.source === 'GENRE' && !f.genre.trim()) return 'Type the genre the row shows'
  if (!Number.isInteger(f.maxItems) || f.maxItems < HOME_ROW_ITEMS.min || f.maxItems > HOME_ROW_ITEMS.max) {
    return `A row shows from ${HOME_ROW_ITEMS.min} to ${HOME_ROW_ITEMS.max} series`
  }
  return null
}

/** The value sent with the row: the category, the genre, or nothing. */
export function homeRowValue(f: Pick<HomeRowForm, 'source' | 'category' | 'genre'>): string | null {
  return f.source === 'CATEGORY' ? f.category : f.source === 'GENRE' ? f.genre.trim() : null
}

/** "Romance · up to 30", "Newest updates · up to 12" — what a row shows, for the list. */
export function describeHomeRow(r: { source: string; value: string | null; maxItems: number }): string {
  const what =
    r.source === 'CATEGORY'
      ? (SERIES_CATEGORIES.find((c) => c.value === r.value)?.label ?? r.value ?? '')
      : r.source === 'GENRE'
        ? `Genre “${r.value ?? ''}”`
        : (HOME_ROW_SOURCES.find((s) => s.value === r.source)?.label ?? r.source)
  return `${what} · up to ${r.maxItems}`
}
