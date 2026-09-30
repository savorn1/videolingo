// The learner's day-by-day study activity, for the streak, daily goal and week
// strip. The backend keeps running totals per video but no history by day, so
// this keeps its own small log in this browser (per account): it follows this
// browser only, and starts counting from when it first runs.

import {
  addActivity,
  currentStreak,
  dateKey,
  DEFAULT_GOAL_MINUTES,
  GOAL_MINUTES,
  goalFraction,
  lastDays,
  longestStreak,
  parseLog,
  pruneLog,
  studySeconds,
  type ActivityLog,
  type DayEntry
} from '#shared/utils/studyActivity'

export function useStudyActivity() {
  const { username } = useAuth()
  const log = useState<ActivityLog>('study-activity', () => ({}))
  const goalMinutes = useState<number>('study-goal-minutes', () => DEFAULT_GOAL_MINUTES)
  const loadedFor = useState<string | null>('study-activity-account', () => null)

  const account = () => username.value ?? 'anon'
  const logKey = () => `videolingo:activity:${account()}`
  const goalKey = () => `videolingo:activity-goal:${account()}`

  /** Reads the stored log once per account (browser only). */
  function load() {
    if (!import.meta.client || loadedFor.value === account()) return
    loadedFor.value = account()
    try {
      log.value = parseLog(localStorage.getItem(logKey()))
      const goal = Number(localStorage.getItem(goalKey()))
      goalMinutes.value = (GOAL_MINUTES as readonly number[]).includes(goal) ? goal : DEFAULT_GOAL_MINUTES
    } catch {
      log.value = {}
      goalMinutes.value = DEFAULT_GOAL_MINUTES
    }
  }

  function persist() {
    try {
      localStorage.setItem(logKey(), JSON.stringify(log.value))
    } catch {
      // Storage can be full or blocked; the streak is a convenience.
    }
  }

  /** Adds study to today. */
  function record(delta: Partial<DayEntry>) {
    if (!import.meta.client) return
    load()
    const today = dateKey(new Date())
    log.value = pruneLog(addActivity(log.value, today, delta), today)
    persist()
  }

  function setGoal(minutes: number) {
    goalMinutes.value = minutes
    try {
      localStorage.setItem(goalKey(), String(minutes))
    } catch {
      // See persist().
    }
  }

  const today = computed(() => dateKey(new Date()))
  const todayEntry = computed<DayEntry>(() => log.value[today.value] ?? { watchSeconds: 0, cards: 0 })
  const todaySeconds = computed(() => studySeconds(log.value[today.value]))
  const goalDone = computed(() => goalFraction(todaySeconds.value, goalMinutes.value))
  const streak = computed(() => currentStreak(log.value, today.value))
  const best = computed(() => longestStreak(log.value))
  const week = computed(() => lastDays(log.value, today.value, 7))

  return { load, record, setGoal, goalMinutes, todayEntry, todaySeconds, goalDone, streak, best, week }
}
