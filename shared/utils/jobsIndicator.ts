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

/** Milliseconds until the next look: often while something is going on, seldom when nothing is, and not at all while the tab is hidden. */
export function nextPollDelay(active: number, hidden: boolean): number | null {
  if (hidden) return null
  return active > 0 ? 5_000 : 20_000
}
