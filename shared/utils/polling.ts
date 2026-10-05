// When to ask the server again, for the screens that poll while something runs
// (usePolling). Nothing while the tab is hidden — it asks again as soon as the
// tab is back — and slower after failures, so an outage isn't hammered.

/** The longest wait between polls after repeated failures. */
export const MAX_POLL_BACKOFF_MS = 60_000

/** Milliseconds until the next poll: null while hidden; doubled for each failure in a row, up to MAX_POLL_BACKOFF_MS. */
export function pollingDelay(baseMs: number, hidden: boolean, failures = 0): number | null {
  if (hidden) return null
  if (failures <= 0) return baseMs
  return Math.min(Math.max(baseMs, MAX_POLL_BACKOFF_MS), baseMs * 2 ** Math.min(failures, 10))
}
