// Pure helpers behind useListQuerySync — kept separate from the composable so
// the fiddly part (turning URL strings back into the types a filter actually
// holds) is testable without mounting Nuxt.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterValue = any

/**
 * Turns one query-string value back into the type the filter held.
 *
 * Filters in this app hold ids (number), flags (boolean) and status enums
 * (string). A stringified id matters: `companyId: "12"` would be sent to the API
 * as a string and silently match nothing, so integers have to come back as
 * numbers. Anything that isn't plainly an integer or a boolean stays a string —
 * notably document numbers like "007" or "1e5", where converting would corrupt
 * the value.
 */
export function coerceQueryValue(raw: string): string | number | boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (/^-?\d+$/.test(raw) && !/^-?0\d/.test(raw)) {
    const asNumber = Number(raw)
    if (Number.isSafeInteger(asNumber)) return asNumber
  }
  return raw
}

/**
 * Builds the query object for the current list state. Empty filters, an empty
 * search and page 1 are all left out so the common case keeps a clean URL.
 */
export function buildListQuery(input: { filter?: Record<string, FilterValue>; search?: string; page?: number }): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(input.filter ?? {})) {
    if (value !== undefined && value !== null && value !== '') query[key] = String(value)
  }
  if (input.search) query.q = input.search
  if (input.page !== undefined && input.page > 1) query.page = String(input.page)
  return query
}
