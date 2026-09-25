// The signed-in user's watch progress (the backend's ProgressController,
// /api/me/** — any account). `useProgressTracker` turns a VideoPlayer's
// `time` / `ended` events into heartbeats, and knows where to resume.

import type { ApiEnvelope } from '#shared/types'

export interface WatchProgress {
  videoId: number
  positionSeconds: number
  durationSeconds: number | null
  watchedSeconds: number
  completed: boolean
  completedAt: string | null
  lastWatchedAt: string | null
  /** 0–100; null when the length is unknown. */
  percent: number | null
}

export interface ContinueItem {
  progress: WatchProgress
  title: string
  thumbnailUrl: string | null
  language: string | null
  videoDurationSeconds: number | null
}

export function useWatchProgress() {
  const api = useApi()

  /** Progress for these videos — ones never watched are simply absent. */
  async function forVideos(videoIds: number[]) {
    if (!videoIds.length) return new Map<number, WatchProgress>()
    const rows = (await api<ApiEnvelope<WatchProgress[]>>('/api/me/progress', { query: { videoIds } })).data
    return new Map(rows.map((p) => [p.videoId, p]))
  }

  async function continueWatching(limit = 12) {
    return (await api<ApiEnvelope<ContinueItem[]>>('/api/me/continue-watching', { query: { limit } })).data
  }

  async function setCompleted(videoId: number, completed: boolean) {
    return (await api<ApiEnvelope<WatchProgress>>(`/api/me/progress/${videoId}/completed`, { method: 'PUT', body: { completed } })).data
  }

  function heartbeat(
    videoId: number,
    body: { sessionId: string; positionSeconds: number; durationSeconds: number | null; watchedSeconds: number; ended: boolean },
    keepalive = false
  ) {
    // keepalive lets the last beat finish even as the page closes.
    return api<ApiEnvelope<WatchProgress>>(`/api/me/progress/${videoId}`, { method: 'PUT', body, keepalive }).then((r) => r.data)
  }

  return { forVideos, continueWatching, setCompleted, heartbeat }
}

const HEARTBEAT_MS = 15_000
/** Gaps longer than this between two time reports are seeks, not watching. */
const MAX_TICK_MS = 2_000

function newSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Tracks one video at a time. Call `start(videoId, durationSeconds)` when a
 * video is shown (it fetches where to resume — see `startAt` / `ready`), feed
 * it the player's events, and it reports progress every 15 s of playing plus
 * on end, on video change, when the tab is hidden and on leaving the page.
 */
export function useProgressTracker() {
  const { forVideos, heartbeat } = useWatchProgress()

  const progress = ref<WatchProgress | null>(null)
  /** Seconds to resume from (null = the beginning). */
  const startAt = ref<number | null>(null)
  /** The resume point is known (or we gave up waiting) — render the player now. */
  const ready = ref(false)

  let videoId: number | null = null
  let duration: number | null = null
  let sessionId = ''
  let lastMs: number | null = null
  let positionS = 0
  let pendingS = 0
  let timer: ReturnType<typeof setInterval> | undefined

  async function send(ended = false, keepalive = false) {
    if (videoId === null || (!ended && pendingS < 1)) return
    const body = { sessionId, positionSeconds: positionS, durationSeconds: duration, watchedSeconds: pendingS, ended }
    pendingS = 0
    try {
      const saved = await heartbeat(videoId, body, keepalive)
      if (saved.videoId === videoId) progress.value = saved
    } catch {
      // Progress is best effort — never interrupt playback over it.
    }
  }

  /** `atSeconds` starts there instead of the saved position (a link to a moment). */
  async function start(id: number, durationSeconds: number | null, atSeconds?: number | null) {
    if (videoId !== null && videoId !== id) await send(false, true)
    videoId = id
    duration = durationSeconds
    sessionId = newSessionId()
    lastMs = null
    positionS = 0
    pendingS = 0
    progress.value = null
    startAt.value = null
    ready.value = false
    const giveUp = setTimeout(() => (ready.value = true), 1500)
    try {
      const p = (await forVideos([id])).get(id) ?? null
      if (videoId !== id) return
      progress.value = p
      startAt.value = atSeconds != null && atSeconds >= 0 ? atSeconds : p && !p.completed && p.positionSeconds > 0 ? p.positionSeconds : null
    } catch {
      // Start from the beginning.
    } finally {
      clearTimeout(giveUp)
      if (videoId === id) ready.value = true
    }
  }

  function onTime(ms: number) {
    if (lastMs !== null) {
      const step = ms - lastMs
      if (step > 0 && step <= MAX_TICK_MS) pendingS += step / 1000
    }
    lastMs = ms
    positionS = ms / 1000
  }

  function onDuration(seconds: number) {
    duration = seconds
  }

  function onEnded() {
    lastMs = null
    send(true)
  }

  function onHidden() {
    if (document.visibilityState === 'hidden') send(false, true)
  }

  onMounted(() => {
    timer = setInterval(() => send(), HEARTBEAT_MS)
    document.addEventListener('visibilitychange', onHidden)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onHidden)
    send(false, true)
  })

  return { progress, startAt, ready, start, onTime, onDuration, onEnded, flush: () => send(false, true) }
}
