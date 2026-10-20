// The Failed filter of the processing jobs page: failed jobs grouped by why they failed, most common first, so one
// cause (e.g. the speech-to-text service being down) can be seen and retried in one go. Numbers in the message
// (job and video ids, sizes, times) don't make a new reason. Pure, so it's tested directly.

export interface FailedJobLike {
  id: number
  type: string
  errorMessage: string | null
  canRetry?: boolean
}

export interface FailureGroup {
  /** The message as the first job of the group says it. */
  reason: string
  count: number
  /** The job types in the group, most common first. */
  types: string[]
  /** The ids that can be retried (not out of attempts, not the kind that can't be). */
  retryable: number[]
}

/** The message with its numbers made alike, for grouping. */
export function reasonKey(message: string | null): string {
  return (message ?? '')
    .trim()
    .toLowerCase()
    .replace(/\d+(\.\d+)?/g, '#')
    .replace(/\s+/g, ' ')
}

export function failureGroups(jobs: FailedJobLike[]): FailureGroup[] {
  const groups = new Map<string, FailureGroup & { typeCounts: Map<string, number> }>()
  for (const j of jobs) {
    const key = reasonKey(j.errorMessage)
    let g = groups.get(key)
    if (!g) {
      g = { reason: j.errorMessage?.trim() || 'No reason given', count: 0, types: [], retryable: [], typeCounts: new Map() }
      groups.set(key, g)
    }
    g.count++
    g.typeCounts.set(j.type, (g.typeCounts.get(j.type) ?? 0) + 1)
    if (j.canRetry !== false) g.retryable.push(j.id)
  }
  return [...groups.values()]
    .map(({ typeCounts, ...g }) => ({ ...g, types: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t) }))
    .sort((a, b) => b.count - a.count)
}
