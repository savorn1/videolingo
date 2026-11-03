// The words on the error page and in the browser tab's title. Kept here so they can be checked.

export interface ErrorCopy {
  /** Shown small above the heading, e.g. "404". */
  code: string
  title: string
  description: string
}

/** Plain-language text for an error status; unknown statuses get a general message. */
export function errorCopy(statusCode: number | null | undefined): ErrorCopy {
  const code = statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : null
  if (code === 404) return { code: '404', title: 'Page not found', description: 'That address doesn’t lead anywhere. It may have been moved or deleted.' }
  if (code === 403)
    return {
      code: '403',
      title: 'You don’t have access to this',
      description: 'Your account can’t open this page. Ask an administrator if you think it should.'
    }
  if (code === 401) return { code: '401', title: 'Please sign in again', description: 'Your session has ended. Sign in to carry on.' }
  if (code && code >= 500)
    return {
      code: String(code),
      title: 'Something went wrong on our side',
      description: 'Try again in a moment. If it keeps happening, tell an administrator.'
    }
  return { code: code ? String(code) : 'Error', title: 'Something went wrong', description: 'Try again, or go back to where you were.' }
}

/** The browser tab's title: "Videos · VideoLingo" on a page, just the site name where there is no page title. */
export function tabTitle(pageTitle: string | undefined | null, siteName: string): string {
  const t = (pageTitle ?? '').trim()
  return t && t !== siteName ? `${t} · ${siteName}` : siteName
}

/** For an address that leads nowhere, up to `max` of the app's own pages (no ":id" parts) that share a word with it,
 *  closest first: "/new" → "/videos/new", "/video" → "/videos". The query and hash are ignored. */
export function nearbyPages(missing: string, pages: string[], max = 3): string[] {
  const words = (p: string) => p.split(/[?#]/)[0]!.toLowerCase().split('/').filter(Boolean)
  const asked = words(missing)
  if (!asked.length) return []
  const alike = (a: string, b: string) => a === b || a === `${b}s` || b === `${a}s`
  const scored = pages
    .filter((p) => p !== '/' && !p.includes(':'))
    .map((page) => {
      const have = words(page)
      const shared = asked.filter((w) => have.some((h) => alike(w, h))).length
      return { page, score: shared * 10 - Math.abs(have.length - asked.length) }
    })
    .filter((s) => s.score > 0 && s.page !== missing.split(/[?#]/)[0])
  return [...new Set(scored.sort((a, b) => b.score - a.score || a.page.localeCompare(b.page)).map((s) => s.page))].slice(0, max)
}
