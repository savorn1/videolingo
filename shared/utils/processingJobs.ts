// Display rules for processing jobs. Pure so they can be tested directly; the
// backend stays the authority on what's actually allowed (canRetry/canCancel/
// canDelete on each job) — these helpers only cover presentation.

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
export type JobType = 'TRANSCODE' | 'TRANSCRIBE' | 'TRANSLATE' | 'GENERATE_SUBTITLES' | 'GENERATE_THUMBNAIL' | 'DUB' | 'DOWNLOAD'

export const JOB_STATUSES: { value: JobStatus; label: string; icon: string }[] = [
  { value: 'QUEUED', label: 'Queued', icon: 'i-lucide-hourglass' },
  { value: 'RUNNING', label: 'Running', icon: 'i-lucide-loader-circle' },
  { value: 'SUCCEEDED', label: 'Succeeded', icon: 'i-lucide-circle-check' },
  { value: 'FAILED', label: 'Failed', icon: 'i-lucide-circle-x' },
  { value: 'CANCELLED', label: 'Cancelled', icon: 'i-lucide-ban' }
]

export const JOB_TYPES: { value: JobType; label: string; icon: string }[] = [
  { value: 'TRANSCODE', label: 'Transcode', icon: 'i-lucide-film' },
  { value: 'TRANSCRIBE', label: 'Transcribe', icon: 'i-lucide-audio-lines' },
  { value: 'TRANSLATE', label: 'Translate', icon: 'i-lucide-languages' },
  { value: 'GENERATE_SUBTITLES', label: 'Generate subtitles', icon: 'i-lucide-captions' },
  { value: 'GENERATE_THUMBNAIL', label: 'Generate thumbnail', icon: 'i-lucide-image' },
  { value: 'DUB', label: 'Voice-over', icon: 'i-lucide-mic' },
  { value: 'DOWNLOAD', label: 'Download / import', icon: 'i-lucide-download' }
]

export function jobTypeMeta(type: string): { label: string; icon: string } {
  return JOB_TYPES.find((t) => t.value === type) ?? { label: humanize(type), icon: 'i-lucide-cog' }
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
