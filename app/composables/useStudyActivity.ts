// The learner's day-by-day study activity, for the streak, daily goal and week
// strip. The backend keeps running totals per video but no history by day, so
// this keeps its own small log. It is written in this browser at once and also
// saved in the user's synced preferences (see useLearnerPrefs), so it follows
// them to another device; the two copies are merged when they meet.

import {
  addActivity,
  currentStreak,
  dateKey,
  DEFAULT_GOAL_MINUTES,
  GOAL_MINUTES,
  goalFraction,
  fromCompact,
  lastDays,
  longestStreak,
  mergeLogs,
  parseLog,
  pruneLog,
  sameLog,
  studySeconds,
  toCompact,
  type ActivityLog,
  type DayEntry
} from '#shared/utils/studyActivity'

/** The server copy is written at most this often while activity keeps coming in. */
const PUSH_EVERY_MS = 60_000
const LOG_KEY = 'studyActivity'
const GOAL_KEY = 'studyGoalMinutes'

export function useStudyActivity() {
  const { username } = useAuth()
  const { load: loadPrefs, appValue, setApp } = useLearnerPrefs()
  const log = useState<ActivityLog>('study-activity', () => ({}))
  const goalMinutes = useState<number>('study-goal-minutes', () => DEFAULT_GOAL_MINUTES)
  const loadedFor = useState<string | null>('study-activity-account', () => null)
  const syncedFor = useState<string | null>('study-activity-synced', () => null)

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
    sync()
  }

  /**
   * Brings the server copy and this browser's copy together, once per account: what each has that the
   * other lacks is kept, and the server is only written to if the merge added something to it.
   */
  async function sync() {
    if (syncedFor.value === account()) return
    syncedFor.value = account()
    const mine = account()
    try {
      await loadPrefs()
      if (account() !== mine) return // another account signed in while waiting
      const server = fromCompact(appValue<unknown>(LOG_KEY, null))
      const merged = pruneLog(mergeLogs(server, log.value), dateKey(new Date()))
      log.value = merged
      persist()
      if (!sameLog(merged, server)) setApp(LOG_KEY, toCompact(merged))

      const serverGoal = Number(appValue<unknown>(GOAL_KEY, 0))
      if ((GOAL_MINUTES as readonly number[]).includes(serverGoal)) {
        goalMinutes.value = serverGoal
        try {
          localStorage.setItem(goalKey(), String(serverGoal))
        } catch {
          // See persist().
        }
      } else if (goalMinutes.value !== DEFAULT_GOAL_MINUTES) {
        setApp(GOAL_KEY, goalMinutes.value) // the goal was only ever chosen in this browser
      }
    } catch {
      // Offline or signed out: the browser copy carries on, and the next visit tries again.
      syncedFor.value = null
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
    pushSoon()
  }

  // Watching adds to the log every few seconds; the server copy is written about once a minute.
  let lastPush = 0
  function pushSoon() {
    if (Date.now() - lastPush < PUSH_EVERY_MS) return
    lastPush = Date.now()
    setApp(LOG_KEY, toCompact(log.value))
  }

  function setGoal(minutes: number) {
    goalMinutes.value = minutes
    setApp(GOAL_KEY, minutes)
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
