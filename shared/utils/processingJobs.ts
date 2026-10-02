// Display rules for processing jobs. Pure so they can be tested directly; the
// backend stays the authority on what's actually allowed (canRetry/canCancel/
// canDelete on each job) — these helpers only cover presentation.

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
export type JobType = 'TRANSCODE' | 'TRANSCRIBE' | 'TRANSLATE' | 'GENERATE_SUBTITLES' | 'GENERATE_THUMBNAIL' | 'DUB' | 'DOWNLOAD' | 'EDIT'

/** How a status looks on its summary tile on the jobs page: a colour edge, the count's colour, and the selected look. Full class names so Tailwind sees them. */
export interface StatusTone {
  edge: string
  count: string
  active: string
}

export const JOB_STATUSES: { value: JobStatus; label: string; icon: string; tone: StatusTone }[] = [
  {
    value: 'QUEUED',
    label: 'Queued',
    icon: 'i-lucide-hourglass',
    tone: {
      edge: 'border-l-gray-400 dark:border-l-gray-500',
      count: 'text-gray-700 dark:text-gray-200',
      active: 'border-gray-500 bg-gray-50 ring-gray-500 dark:bg-gray-800/60'
    }
  },
  {
    value: 'RUNNING',
    label: 'Running',
    icon: 'i-lucide-loader-circle',
    tone: { edge: 'border-l-sky-500', count: 'text-sky-700 dark:text-sky-300', active: 'border-sky-500 bg-sky-50 ring-sky-500 dark:bg-sky-950/40' }
  },
  {
    value: 'SUCCEEDED',
    label: 'Succeeded',
    icon: 'i-lucide-circle-check',
    tone: {
      edge: 'border-l-emerald-500',
      count: 'text-emerald-700 dark:text-emerald-300',
      active: 'border-emerald-500 bg-emerald-50 ring-emerald-500 dark:bg-emerald-950/40'
    }
  },
  {
    value: 'FAILED',
    label: 'Failed',
    icon: 'i-lucide-circle-x',
    tone: { edge: 'border-l-red-500', count: 'text-red-700 dark:text-red-300', active: 'border-red-500 bg-red-50 ring-red-500 dark:bg-red-950/40' }
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    icon: 'i-lucide-ban',
    tone: {
      edge: 'border-l-orange-500',
      count: 'text-orange-700 dark:text-orange-300',
      active: 'border-orange-500 bg-orange-50 ring-orange-500 dark:bg-orange-950/40'
    }
  }
]

/** Each kind of job has its own colour, so a long list can be scanned by it: a soft tile behind the icon. */
export const JOB_TYPES: { value: JobType; label: string; icon: string; tone: string }[] = [
  { value: 'TRANSCODE', label: 'Transcode', icon: 'i-lucide-film', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { value: 'TRANSCRIBE', label: 'Transcribe', icon: 'i-lucide-audio-lines', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  { value: 'TRANSLATE', label: 'Translate', icon: 'i-lucide-languages', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  {
    value: 'GENERATE_SUBTITLES',
    label: 'Generate subtitles',
    icon: 'i-lucide-captions',
    tone: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
  },
  { value: 'GENERATE_THUMBNAIL', label: 'Generate thumbnail', icon: 'i-lucide-image', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { value: 'DUB', label: 'Voice-over', icon: 'i-lucide-mic', tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'DOWNLOAD', label: 'Download / import', icon: 'i-lucide-download', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { value: 'EDIT', label: 'Trim / crop / split', icon: 'i-lucide-scissors', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' }
]

export function jobTypeMeta(type: string): { label: string; icon: string; tone: string } {
  return (
    JOB_TYPES.find((t) => t.value === type) ?? {
      label: humanize(type),
      icon: 'i-lucide-cog',
      tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  )
}

/** Queued or running — the job can still change on its own, so views should keep polling it. */
export function isActiveJobStatus(status: string): boolean {
  return status === 'QUEUED' || status === 'RUNNING'
}

/**
 * Pretty-prints a job's `parameters` JSON for display. Returns null for
 * empty input, and the raw string unchanged if it isn't valid JSON — a
 * malformed value is still worth showing as-is rather than hiding.
 */
export function formatJobParameters(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

/** Plain-text export of log lines, one per line: "2026-09-23 12:00:01 INFO  message". */
export function logsToText(lines: { level: string; message: string; createdAt: string }[]): string {
  return lines.map((l) => `${l.createdAt.replace('T', ' ').slice(0, 19)} ${l.level.padEnd(5)} ${l.message}`).join('\n')
}
