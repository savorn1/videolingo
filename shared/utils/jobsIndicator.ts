// The little "jobs are running" indicator in the header: what to show from the
// per-status counts, and how often to look again.

export interface JobCounts {
  QUEUED?: number
  RUNNING?: number
}

export function activeJobs(counts: JobCounts | null | undefined): { running: number; waiting: number; total: number } {
  const running = Math.max(0, counts?.RUNNING ?? 0)
  const waiting = Math.max(0, counts?.QUEUED ?? 0)
  return { running, waiting, total: running + waiting }
}

/** "2 jobs running, 3 waiting"; the parts that are zero are left out. */
export function jobsLabel(counts: JobCounts | null | undefined): string {
  const { running, waiting } = activeJobs(counts)
  const parts: string[] = []
  if (running) parts.push(`${running} job${running === 1 ? '' : 's'} running`)
  if (waiting) parts.push(`${waiting} ${running ? '' : `job${waiting === 1 ? '' : 's'} `}waiting`.replace('  ', ' '))
  return parts.join(', ')
}

/**
 * Milliseconds until the next look: often while something is going on, seldom when nothing is. While the tab is
 * hidden, only now and then while jobs are active (so a finished one can be told about), else not at all.
 */
export function nextPollDelay(active: number, hidden: boolean): number | null {
  if (hidden) return active > 0 ? 30_000 : null
  return active > 0 ? 5_000 : 20_000
}

/** The tab's title with the number of active jobs in front, "(2) Videos · VideoLingo"; as it is when there are none. */
export function withJobCount(title: string, active: number): string {
  return active > 0 ? `(${active}) ${title}` : title
}

export interface EndedJob {
  id: number
  status: string
  typeLabel: string
  videoTitle: string | null
  errorMessage: string | null
}

/**
 * What to say when jobs end: one job by name ("Translate finished", the video, or why it failed), several as a
 * count ("3 jobs finished, 1 failed"). `to` is where Open goes: the job, or the jobs list.
 */
export function endedJobsMessage(jobs: EndedJob[]): { title: string; description?: string; color: 'success' | 'error' | 'neutral'; to: string } | null {
  if (!jobs.length) return null
  const failed = jobs.filter((j) => j.status === 'FAILED').length
  const cancelled = jobs.filter((j) => j.status === 'CANCELLED').length
  const succeeded = jobs.length - failed - cancelled
  if (jobs.length === 1) {
    const j = jobs[0]!
    const outcome = j.status === 'FAILED' ? 'failed' : j.status === 'CANCELLED' ? 'cancelled' : 'finished'
    const description = j.status === 'FAILED' && j.errorMessage ? `${j.videoTitle ? `${j.videoTitle}: ` : ''}${j.errorMessage}` : (j.videoTitle ?? undefined)
    return { title: `${j.typeLabel} ${outcome}`, description, color: failed ? 'error' : cancelled ? 'neutral' : 'success', to: `/processing-jobs/${j.id}` }
  }
  const parts = [succeeded && `${succeeded} finished`, failed && `${failed} failed`, cancelled && `${cancelled} cancelled`].filter(Boolean)
  return { title: `${jobs.length} jobs ended: ${parts.join(', ')}`, color: failed ? 'error' : 'success', to: '/processing-jobs' }
}
