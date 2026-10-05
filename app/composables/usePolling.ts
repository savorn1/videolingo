// Calls `tick` every `intervalMs` while `active()` is true and the tab is visible.
// The next call is scheduled only once the last one has finished (no pile-up on a
// slow server); a hidden tab or a lost connection stops it, and coming back runs it at once; a tick that
// throws makes the next wait longer (pollingDelay). Stops when the component goes.

import { onBeforeUnmount, onMounted, watch } from 'vue'
import { pollingDelay } from '#shared/utils/polling'

export function usePolling(
  tick: () => unknown,
  options: {
    intervalMs: number
    /** Poll only while this is true (reactive); leave out to always poll. */
    active?: () => boolean
    /** Also run once when mounted, instead of waiting one interval first. */
    immediate?: boolean
  }
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let failures = 0
  let mounted = false
  const isActive = () => (options.active ? options.active() : true)

  function schedule() {
    clearTimeout(timer)
    if (!mounted || !isActive()) return
    const delay = pollingDelay(options.intervalMs, document.visibilityState === 'hidden' || !navigator.onLine, failures)
    if (delay !== null) timer = setTimeout(run, delay)
  }

  /** Runs `tick` now (unless one is already running), then waits for the next. */
  async function run() {
    clearTimeout(timer)
    if (running) return
    running = true
    try {
      await tick()
      failures = 0
    } catch {
      failures++
    } finally {
      running = false
      schedule()
    }
  }

  function onVisibility() {
    if (document.visibilityState === 'visible' && navigator.onLine && isActive()) run()
    else clearTimeout(timer)
  }

  watch(isActive, (on) => (on ? schedule() : clearTimeout(timer)))
  onMounted(() => {
    mounted = true
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onVisibility)
    window.addEventListener('offline', onVisibility)
    if (options.immediate) run()
    else schedule()
  })
  onBeforeUnmount(() => {
    mounted = false
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onVisibility)
    window.removeEventListener('offline', onVisibility)
  })

  return { refresh: run }
}
