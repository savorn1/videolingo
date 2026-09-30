// A learner's day-by-day study activity — the numbers behind the streak, the
// daily goal and the week strip on the Learn page. The API only keeps running
// totals per video, so days are counted from what this browser saw; dates are
// the learner's local calendar days ("YYYY-MM-DD").

export interface DayEntry {
  /** Seconds of video actually watched (seeks don't count). */
  watchSeconds: number
  /** Flashcards reviewed. */
  cards: number
}
export type ActivityLog = Record<string, DayEntry>

/** Reviewing a card is counted as this much study time toward the goal. */
export const CARD_SECONDS = 30
/** A day keeps the streak alive once it has this much study. */
export const ACTIVE_MIN_SECONDS = 60
export const GOAL_MINUTES = [5, 10, 20, 30] as const
export const DEFAULT_GOAL_MINUTES = 10

const two = (n: number) => String(n).padStart(2, '0')

/** A local calendar day as a sortable key. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

/** The day `days` before (negative) or after `key`. Uses noon so a daylight-saving change can't skip or repeat a day. */
export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y!, m! - 1, d! + days, 12))
}

export function studySeconds(entry: DayEntry | undefined): number {
  return entry ? entry.watchSeconds + entry.cards * CARD_SECONDS : 0
}

export function isActiveDay(entry: DayEntry | undefined): boolean {
  return studySeconds(entry) >= ACTIVE_MIN_SECONDS
}

/** Adds to one day. Returns a new log; the input is left alone. */
export function addActivity(log: ActivityLog, key: string, delta: Partial<DayEntry>): ActivityLog {
  const day = log[key] ?? { watchSeconds: 0, cards: 0 }
  return {
    ...log,
    [key]: { watchSeconds: day.watchSeconds + Math.max(0, delta.watchSeconds ?? 0), cards: day.cards + Math.max(0, delta.cards ?? 0) }
  }
}

/**
 * Days in a row with study, counting back from today. Today not being done yet
 * doesn't break it (there is still time), so it counts back from yesterday then.
 */
export function currentStreak(log: ActivityLog, todayKey: string): number {
  let day = isActiveDay(log[todayKey]) ? todayKey : shiftDay(todayKey, -1)
  let streak = 0
  while (isActiveDay(log[day])) {
    streak++
    day = shiftDay(day, -1)
  }
  return streak
}

/** The longest run of consecutive study days in the log. */
export function longestStreak(log: ActivityLog): number {
  const days = Object.keys(log)
    .filter((k) => isActiveDay(log[k]))
    .sort()
  let best = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && shiftDay(days[i - 1]!, 1) === days[i] ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

/** The last `n` days ending today, oldest first. */
export function lastDays(log: ActivityLog, todayKey: string, n: number): { key: string; seconds: number; active: boolean }[] {
  return Array.from({ length: n }, (_, i) => {
    const key = shiftDay(todayKey, i - (n - 1))
    return { key, seconds: studySeconds(log[key]), active: isActiveDay(log[key]) }
  })
}

/** How much of the daily goal is done, 0 to 1. */
export function goalFraction(seconds: number, goalMinutes: number): number {
  return goalMinutes > 0 ? Math.min(1, Math.max(0, seconds / (goalMinutes * 60))) : 0
}

/** Drops days older than `keepDays`, so the stored log stays small. */
export function pruneLog(log: ActivityLog, todayKey: string, keepDays = 400): ActivityLog {
  const oldest = shiftDay(todayKey, -keepDays)
  return Object.fromEntries(Object.entries(log).filter(([key]) => key >= oldest))
}

/** Reads a stored log defensively — anything that isn't the expected shape is dropped. */
export function parseLog(raw: string | null): ActivityLog {
  if (!raw) return {}
  try {
    const data = JSON.parse(raw) as Record<string, Partial<DayEntry>>
    const log: ActivityLog = {}
    for (const [key, v] of Object.entries(data ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && v && Number.isFinite(v.watchSeconds) && Number.isFinite(v.cards)) {
        log[key] = { watchSeconds: Math.max(0, v.watchSeconds!), cards: Math.max(0, v.cards!) }
      }
    }
    return log
  } catch {
    return {}
  }
}
