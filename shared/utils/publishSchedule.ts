// Scheduling a disabled video to be enabled by itself (backend PublishSchedule: from now to a year ahead).
import { formatDateTime } from './format'

/** The status badge for a video: enabled, scheduled (with when), or disabled. */
export function videoStatusBadge(v: { enabled: boolean; publishAt?: string | null }): { label: string; color: 'success' | 'info' | 'warning' } {
  if (v.enabled) return { label: 'Enabled', color: 'success' }
  if (v.publishAt) return { label: `Scheduled · ${formatDateTime(v.publishAt)}`, color: 'info' }
  return { label: 'Disabled', color: 'warning' }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A date as a datetime-local input's value ("2026-10-10T09:00"), in the browser's time. */
export function toDateTimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** A datetime-local input's value as a date (browser time), or null when it isn't one. */
export function fromDateTimeLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Quick choices: in an hour (to the next quarter), tomorrow at 9:00, next Monday at 9:00. */
export function schedulePresets(now: Date): { label: string; at: Date }[] {
  const hour = new Date(now.getTime() + 60 * 60 * 1000)
  hour.setMinutes(Math.ceil(hour.getMinutes() / 15) * 15, 0, 0)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0)
  const toMonday = (8 - now.getDay()) % 7 || 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + toMonday, 9, 0)
  return [
    { label: 'In an hour', at: hour },
    { label: 'Tomorrow 9:00', at: tomorrow },
    { label: 'Monday 9:00', at: monday }
  ]
}

/** Why a chosen time can't be used (as the server will say), or null. */
export function scheduleProblem(at: Date | null, now: Date): string | null {
  if (!at) return 'Choose a date and time'
  if (at.getTime() < now.getTime() - 2 * 60 * 1000) return 'Choose a time in the future'
  if (at.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) return 'A video can be scheduled at most a year ahead'
  return null
}

/** How far apart videos scheduled together are, as offered. */
export const SCHEDULE_STEPS = [
  { label: 'An hour apart', value: 60 * 60 * 1000 },
  { label: 'A day apart', value: 24 * 60 * 60 * 1000 },
  { label: 'A week apart', value: 7 * 24 * 60 * 60 * 1000 }
] as const

/**
 * Scheduling several videos in turn: the first disabled one at `start`, each next one `stepMs` later. Enabled videos
 * are left out (with why), and so is any time past what the server accepts (a year ahead).
 */
export function scheduleSeries<V extends { enabled: boolean; deleted?: boolean }>(
  videos: V[],
  start: Date,
  stepMs: number,
  now: Date
): { video: V; at: Date | null; skipped: string | null }[] {
  let n = 0
  return videos.map((video) => {
    if (video.deleted) return { video, at: null, skipped: 'in the trash' }
    if (video.enabled) return { video, at: null, skipped: 'already enabled' }
    const at = new Date(start.getTime() + n++ * stepMs)
    const problem = scheduleProblem(at, now)
    return problem ? { video, at: null, skipped: problem } : { video, at, skipped: null }
  })
}
