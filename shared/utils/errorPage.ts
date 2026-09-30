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
  if (code === 403) return { code: '403', title: 'You don’t have access to this', description: 'Your account can’t open this page. Ask an administrator if you think it should.' }
  if (code === 401) return { code: '401', title: 'Please sign in again', description: 'Your session has ended. Sign in to carry on.' }
  if (code && code >= 500) return { code: String(code), title: 'Something went wrong on our side', description: 'Try again in a moment. If it keeps happening, tell an administrator.' }
  return { code: code ? String(code) : 'Error', title: 'Something went wrong', description: 'Try again, or go back to where you were.' }
}

/** The browser tab's title: "Videos · VideoLingo" on a page, just the site name where there is no page title. */
export function tabTitle(pageTitle: string | undefined | null, siteName: string): string {
  const t = (pageTitle ?? '').trim()
  return t && t !== siteName ? `${t} · ${siteName}` : siteName
}
