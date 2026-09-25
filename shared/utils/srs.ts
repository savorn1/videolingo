// Mirror of the backend's spaced repetition (learn/Srs.java), used only to
// show what each review button will schedule ("Good · 3d"). The server's
// result is what counts — keep the two in step.

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export interface SrsState {
  ease: number
  intervalDays: number
  repetitions: number
}

const MAX_INTERVAL_DAYS = 365

/** Days until the card is due again after this grade (0 = in 10 minutes). */
export function nextIntervalDays(s: SrsState, grade: Grade): number {
  let ease = s.ease
  const reps = s.repetitions + 1
  let interval: number
  switch (grade) {
    case 'AGAIN':
      return 0
    case 'HARD':
      interval = reps === 1 ? 1 : Math.max(s.intervalDays + 1, Math.round(s.intervalDays * 1.2))
      break
    case 'GOOD':
      interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(s.intervalDays + 1, Math.round(s.intervalDays * ease))
      break
    case 'EASY':
      // Like the Java: the raised ease is used as-is here and only clamped afterwards.
      ease += 0.15
      interval = reps === 1 ? 3 : Math.max(s.intervalDays + 2, Math.round(s.intervalDays * ease * 1.3))
      break
  }
  return Math.min(interval, MAX_INTERVAL_DAYS)
}

export function formatInterval(days: number): string {
  if (days === 0) return '<10m'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}
