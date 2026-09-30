// What background jobs are doing right now, looked at once for the whole page.
// The header indicator, the Videos list badges and the Dashboard's "Processing
// now" card all need this; they used to each ask on their own timer. Now one
// timer asks (while at least one of them is on screen), and they all read the
// same answer, so they always agree and the server is asked less.

import { makingLabel, makingOperation, type MakingOperation } from '#shared/utils/audioVideo'
import { nextPollDelay, type JobCounts } from '#shared/utils/jobsIndicator'
import { finishedMaking } from '#shared/utils/audioVideo'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

export interface MakingInfo {
  operation: MakingOperation
  status: string
  progress: number
  label: string
}

// Shared by every user of this composable. Only ever filled in the browser.
const counts = ref<JobCounts | null>(null)
const running = ref<ProcessingJob[]>([])
const making = ref(new Map<number, MakingInfo>())
const finishedListeners = new Set<(videoIds: number[]) => void>()
const endedListeners = new Set<(jobIds: number[]) => void>()

let watchers = 0
let timer: ReturnType<typeof setTimeout> | undefined
let inflight = false

export function useJobActivity(options: { onVideosFinished?: (videoIds: number[]) => void; onJobsEnded?: (jobIds: number[]) => void } = {}) {
  const { can } = useAuth()
  const { summary, list } = useProcessingJobs()
  const allowed = computed(() => can('processing-jobs', 'READ'))

  async function refresh() {
    clearTimeout(timer)
    if (!allowed.value || inflight) return schedule()
    inflight = true
    try {
      const [sum, runningPage, queuedPage] = await Promise.all([
        summary(),
        list({ status: 'RUNNING', size: 20, sortBy: 'id', sortOrder: 'desc' }),
        list({ status: 'QUEUED', size: 50 })
      ])
      counts.value = sum

      const nextMaking = new Map<number, MakingInfo>()
      for (const job of [...runningPage.data, ...queuedPage.data]) {
        if (job.type !== 'EDIT') continue
        const operation = makingOperation(job.parameters)
        if (operation) {
          nextMaking.set(job.videoId, { operation, status: job.status, progress: job.progress, label: makingLabel(operation, job.status, job.progress, job.queuePosition) })
        }
      }
      const endedJobs = running.value.filter((j) => !runningPage.data.some((r) => r.id === j.id)).map((j) => j.id)
      const doneVideos = finishedMaking(making.value.keys(), new Set(nextMaking.keys()))
      running.value = runningPage.data
      making.value = nextMaking
      if (endedJobs.length) endedListeners.forEach((cb) => cb(endedJobs))
      if (doneVideos.length) finishedListeners.forEach((cb) => cb(doneVideos))
    } catch {
      // No permission, or offline for a moment: everything just stays as it was.
    } finally {
      inflight = false
    }
    schedule()
  }

  function schedule() {
    clearTimeout(timer)
    if (watchers === 0 || !allowed.value) return
    const active = (counts.value?.RUNNING ?? 0) + (counts.value?.QUEUED ?? 0)
    const delay = nextPollDelay(active, document.visibilityState === 'hidden')
    if (delay !== null) timer = setTimeout(refresh, delay)
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') refresh()
    else clearTimeout(timer)
  }

  onMounted(() => {
    watchers++
    if (options.onVideosFinished) finishedListeners.add(options.onVideosFinished)
    if (options.onJobsEnded) endedListeners.add(options.onJobsEnded)
    document.addEventListener('visibilitychange', onVisibility)
    // The first one on screen starts the timer; later ones read what is already there.
    if (watchers === 1 || !counts.value) refresh()
  })
  onBeforeUnmount(() => {
    watchers = Math.max(0, watchers - 1)
    if (options.onVideosFinished) finishedListeners.delete(options.onVideosFinished)
    if (options.onJobsEnded) endedListeners.delete(options.onJobsEnded)
    document.removeEventListener('visibilitychange', onVisibility)
    if (watchers === 0) clearTimeout(timer)
  })

  return { counts, running, making, refresh, allowed }
}
