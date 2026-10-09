// The pages opened lately, offered first in the Cmd/Ctrl+K search (kept in this browser).

export interface RecentPage {
  path: string
  label: string
}

export const MAX_RECENT_PAGES = 8

/** Pages not worth offering: signing in and out, and the error page. */
const SKIPPED = /^\/(login|forgot-password|reset-password)(\/|$)/

/** The list with `page` at the front (moved up, with its newest label, if it was there already). */
export function pushRecentPage(list: RecentPage[], page: RecentPage, max = MAX_RECENT_PAGES): RecentPage[] {
  const label = page.label.trim()
  if (!label || SKIPPED.test(page.path)) return list
  return [{ path: page.path, label }, ...list.filter((p) => p.path !== page.path)].slice(0, max)
}

/** A stored list made safe: well-formed entries with a path starting "/" and a label, no repeats, at most `max`. */
export function sanitizeRecentPages(raw: unknown, max = MAX_RECENT_PAGES): RecentPage[] {
  if (!Array.isArray(raw)) return []
  const out: RecentPage[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const { path, label } = r as Record<string, unknown>
    if (typeof path !== 'string' || !path.startsWith('/') || typeof label !== 'string' || !label.trim()) continue
    if (out.some((p) => p.path === path)) continue
    out.push({ path, label: label.trim().slice(0, 120) })
    if (out.length === max) break
  }
  return out
}
