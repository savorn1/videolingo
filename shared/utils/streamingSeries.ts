// A collection's settings as a series on the public streaming site (RuengFlix): the form state, what is
// sent to the backend (CollectionRequest.streaming, StreamingSettingsDto) and the checks before saving.
// The backend enforces the same limits; these give the reason before the round trip.

export type SeriesCategory = 'CULTIVATION' | 'ROMANCE' | 'FANTASY'
export type SeriesStatus = 'ONGOING' | 'COMPLETED'

/** As sent to and returned by the backend. */
export interface StreamingSettings {
  enabled: boolean
  category: SeriesCategory | null
  status: SeriesStatus | null
  vip: boolean
  freeEpisodes: number
  recapSeconds: number
  searchKeywords: string | null
  region: string | null
  releaseYear: number | null
  genres: string[]
  bannerUrl: string | null
  verticalUrl: string | null
  /** Place in RuengFlix's home hero (1 first); null = not a hero pick. Also set from RuengFlix › Overview. */
  featuredRank: number | null
}

/** Editable copy for the form: genres as one comma-separated line, blanks as ''. */
export interface StreamingForm {
  enabled: boolean
  category: SeriesCategory | undefined
  status: SeriesStatus
  vip: boolean
  freeEpisodes: number
  recapSeconds: number
  searchKeywords: string
  region: string
  releaseYear: number | undefined
  genres: string
  bannerUrl: string
  verticalUrl: string
  featuredRank: number | undefined
}

export const SERIES_CATEGORIES: { value: SeriesCategory; label: string }[] = [
  { value: 'CULTIVATION', label: 'Cultivation & martial arts' },
  { value: 'ROMANCE', label: 'Romance' },
  { value: 'FANTASY', label: 'Fantasy' }
]

export const SERIES_STATUSES: { value: SeriesStatus; label: string }[] = [
  { value: 'ONGOING', label: 'Ongoing — new episodes coming' },
  { value: 'COMPLETED', label: 'Completed' }
]

/** Limits the backend enforces (StreamingSettingsDto). */
export const STREAMING_LIMITS = {
  maxFreeEpisodes: 100,
  maxRecapSeconds: 300,
  maxGenres: 5,
  maxGenreLength: 60,
  minYear: 1990,
  maxYear: 2100,
  maxFeaturedRank: 99
}

/** Form state for a collection's current settings (or the defaults: off, 3 free episodes). */
export function streamingFormFrom(s: StreamingSettings | null | undefined): StreamingForm {
  return {
    enabled: s?.enabled ?? false,
    category: s?.category ?? undefined,
    status: s?.status ?? 'ONGOING',
    vip: s?.vip ?? false,
    freeEpisodes: s?.freeEpisodes ?? 3,
    recapSeconds: s?.recapSeconds ?? 0,
    searchKeywords: s?.searchKeywords ?? '',
    region: s?.region ?? '',
    releaseYear: s?.releaseYear ?? undefined,
    genres: (s?.genres ?? []).join(', '),
    bannerUrl: s?.bannerUrl ?? '',
    verticalUrl: s?.verticalUrl ?? '',
    featuredRank: s?.featuredRank ?? undefined
  }
}

/** Genres typed as one line: split on commas, trimmed, blanks dropped. */
export function splitGenreLine(line: string): string[] {
  return line
    .split(',')
    .map((g) => g.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
}

/** What to send as `streaming` in the collection request. */
export function streamingPayloadFrom(form: StreamingForm): StreamingSettings {
  const text = (v: string) => v.trim() || null
  return {
    enabled: form.enabled,
    category: form.category ?? null,
    status: form.status,
    vip: form.vip,
    freeEpisodes: form.freeEpisodes,
    recapSeconds: form.recapSeconds,
    searchKeywords: text(form.searchKeywords),
    region: text(form.region),
    releaseYear: form.releaseYear ?? null,
    genres: splitGenreLine(form.genres),
    bannerUrl: text(form.bannerUrl),
    verticalUrl: text(form.verticalUrl),
    featuredRank: form.featuredRank ?? null
  }
}

const isHttpUrl = (v: string) => {
  try {
    const url = new URL(v)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Reasons the settings can't be saved; empty when they can. Only checked while the series is on. */
export function streamingProblems(form: StreamingForm): string[] {
  if (!form.enabled) return []
  const L = STREAMING_LIMITS
  const problems: string[] = []
  const whole = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

  if (!form.category) problems.push('Pick a category so the series is listed on the right shelf.')
  if (form.vip && !whole(form.freeEpisodes, 0, L.maxFreeEpisodes)) problems.push(`Free episodes must be a whole number from 0 to ${L.maxFreeEpisodes}.`)
  if (!whole(form.recapSeconds, 0, L.maxRecapSeconds)) problems.push(`Recap length must be a whole number of seconds from 0 to ${L.maxRecapSeconds}.`)
  if (form.releaseYear !== undefined && !whole(form.releaseYear, L.minYear, L.maxYear)) problems.push(`Year must be between ${L.minYear} and ${L.maxYear}.`)
  if (form.featuredRank !== undefined && !whole(form.featuredRank, 1, L.maxFeaturedRank))
    problems.push(`Hero position must be a whole number from 1 to ${L.maxFeaturedRank}, or blank.`)

  const genres = splitGenreLine(form.genres)
  if (genres.length > L.maxGenres) problems.push(`At most ${L.maxGenres} genres (you have ${genres.length}).`)
  if (genres.some((g) => g.length > L.maxGenreLength)) problems.push(`Each genre can be at most ${L.maxGenreLength} characters.`)

  for (const [label, value] of [
    ['Banner image', form.bannerUrl],
    ['Vertical image', form.verticalUrl]
  ] as const) {
    if (value.trim() && !isHttpUrl(value.trim())) problems.push(`${label} must be a full http(s) link.`)
  }
  return problems
}

/** Why a series that is switched on won't show on the site yet; null when nothing stops it. */
export function streamingVisibilityNote(enabled: boolean, visibility: string): string | null {
  return enabled && visibility !== 'PUBLIC' ? 'Only Public collections appear on RuengFlix — this one stays hidden until its visibility is Public.' : null
}
