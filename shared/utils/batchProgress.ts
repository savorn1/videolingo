// Following a batch of videos being made ("Video from audio" with several files): which jobs to
// follow, read from the page address, and a one-line summary of how far the batch has got.

import { isActiveJobStatus } from './processingJobs'

/** Most jobs one page follows (a batch is at most 20 files, each split into a few parts). */
export const MAX_BATCH_JOBS = 100

/** The job ids in `?jobs=7,8,9`: positive whole numbers, each once, in order, at most MAX_BATCH_JOBS. */
export function parseJobIds(raw: unknown): number[] {
  const text = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : ''
  const ids: number[] = []
  for (const part of text.split(',')) {
    const n = Number(part.trim())
    if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n)
  }
  return ids.slice(0, MAX_BATCH_JOBS)
}

export interface BatchCounts {
  total: number
  done: number
  failed: number
  active: number
}

/** How many of the jobs are done, failed (or cancelled) and still going; a job not loaded yet counts as going. */
export function batchCounts(statuses: (string | null)[]): BatchCounts {
  const done = statuses.filter((s) => s === 'SUCCEEDED').length
  const failed = statuses.filter((s) => s === 'FAILED' || s === 'CANCELLED').length
  const active = statuses.filter((s) => s === null || isActiveJobStatus(s)).length
  return { total: statuses.length, done, failed, active }
}

/** "3 of 5 ready · 1 failed", "All 5 ready", "All 2 failed". */
export function batchSummary(c: BatchCounts): string {
  if (!c.total) return 'Nothing to follow'
  if (c.done === c.total) return c.total === 1 ? 'Ready' : `All ${c.total} ready`
  if (c.failed === c.total) return c.total === 1 ? 'Failed' : `All ${c.total} failed`
  const parts = [`${c.done} of ${c.total} ready`]
  if (c.failed) parts.push(`${c.failed} failed`)
  return parts.join(' · ')
}
