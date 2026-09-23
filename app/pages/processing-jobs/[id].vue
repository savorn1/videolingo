<template>
  <div>
    <PageHeader
      :title="job ? `Job #${job.id} · ${jobTypeMeta(job.type).label}` : 'Processing job'"
      :crumbs="[{ label: 'Processing jobs', to: '/processing-jobs' }, { label: job ? `#${job.id}` : '…' }]"
    >
      <template v-if="job" #actions>
        <UButton v-if="job.canRetry" color="primary" variant="soft" icon="i-lucide-rotate-ccw" @click="request(job, 'retry')">Retry</UButton>
        <UButton v-if="job.canCancel" color="warning" variant="soft" icon="i-lucide-circle-stop" @click="request(job, 'cancel')">Cancel</UButton>
        <UButton v-if="job.canDelete" color="error" variant="soft" icon="i-lucide-trash-2" @click="request(job, 'delete')">Delete</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/processing-jobs">Back to jobs</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !job" :fields="6" />

    <template v-else-if="job">
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <!-- View Processing Progress -->
        <UCard class="xl:col-span-2">
          <div class="flex items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
              <StatusBadge :status="job.status" />
              <span v-if="active" class="text-xs text-gray-500 dark:text-gray-400">Updating live</span>
            </div>
            <span class="text-sm tabular-nums text-gray-500 dark:text-gray-400">
              <template v-if="job.durationSeconds !== null">{{ job.finishedAt ? 'Took' : 'Running for' }} {{ formatDuration(job.durationSeconds) }}</template>
              <template v-else-if="job.status === 'QUEUED'">Queued {{ formatRelativeTime(job.createdAt) }}</template>
            </span>
          </div>

          <JobProgress :status="job.status" :progress="job.progress" :current-step="job.currentStep" size="lg" />

          <UAlert
            v-if="job.status === 'FAILED' && job.errorMessage"
            class="mt-4"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-x"
            title="Error"
            :description="job.errorMessage"
          />
          <UAlert
            v-else-if="job.status === 'CANCELLED'"
            class="mt-4"
            color="neutral"
            variant="subtle"
            icon="i-lucide-ban"
            title="Cancelled"
            :description="`Stopped at ${job.progress}%. Retry to run it again from the start.`"
          />
          <UAlert
            v-if="job.status === 'FAILED' && job.attempts >= job.maxAttempts"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-repeat"
            :title="`All ${job.maxAttempts} attempts used`"
            description="Automatic retries have stopped. A manual retry still works, but check the logs first — it will probably fail the same way."
          />
        </UCard>

        <UCard>
          <dl class="space-y-3 text-sm">
            <div v-for="item in details" :key="item.label" class="flex justify-between gap-4">
              <dt class="text-gray-500 dark:text-gray-400 shrink-0">{{ item.label }}</dt>
              <dd class="font-semibold text-gray-900 dark:text-white text-right tabular-nums truncate" :title="item.title ?? item.value">
                <NuxtLink v-if="item.to" :to="item.to" class="text-primary-600 dark:text-primary-400 hover:underline">{{ item.value }}</NuxtLink>
                <template v-else>{{ item.value }}</template>
              </dd>
            </div>
          </dl>
          <template v-if="parameters">
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-4 mb-1">Parameters</p>
            <pre class="text-xs font-mono bg-gray-50 dark:bg-gray-800/60 rounded-md p-3 overflow-x-auto">{{ parameters }}</pre>
          </template>
        </UCard>
      </div>

      <!-- View Processing Logs -->
      <UCard id="logs" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">Logs</h2>
              <UBadge color="neutral" variant="subtle" size="sm">{{ logLines.length.toLocaleString() }}{{ logsTruncated ? '+' : '' }}</UBadge>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <USelect v-model="minLevel" :items="levelOptions" size="sm" class="w-36" />
              <UInput v-model="logSearch" size="sm" placeholder="Filter lines" icon="i-lucide-search" class="w-44" />
              <USwitch v-model="follow" label="Follow" size="sm" />
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-copy" :disabled="!visibleLines.length" @click="copyLogs">Copy</UButton>
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-download" :disabled="!logLines.length" @click="downloadLogs">Download</UButton>
            </div>
          </div>
        </template>

        <div ref="logBox" class="h-[28rem] overflow-auto bg-gray-950 font-mono text-xs leading-5 rounded-b-lg" @scroll="onLogScroll">
          <div v-if="logsLoading && !logLines.length" class="p-4 text-gray-500">Loading logs…</div>
          <div v-else-if="!logLines.length" class="p-4 text-gray-500">No log output yet.</div>
          <div v-else-if="!visibleLines.length" class="p-4 text-gray-500">No lines match the current filter.</div>
          <table v-else class="w-full">
            <tbody>
              <tr v-for="line in visibleLines" :key="line.id" class="align-top hover:bg-white/5">
                <td class="w-px pl-4 pr-3 text-gray-500 whitespace-nowrap select-none" :title="formatDateTime(line.createdAt)">
                  {{ logTime(line.createdAt) }}
                </td>
                <td class="w-px pr-3 whitespace-nowrap font-semibold" :class="LEVEL_CLASS[line.level]">{{ line.level }}</td>
                <td class="pr-4 text-gray-200 whitespace-pre-wrap break-all">{{ line.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>

    <ConfirmModal
      :model-value="dialog.open"
      :title="dialog.title"
      :description="dialog.description"
      :confirm-label="dialog.confirmLabel"
      :color="dialog.color"
      :loading="busy"
      @update:model-value="close"
      @confirm="confirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { LogLevel } from '#shared/utils/processingJobs'
import type { ProcessingJob, ProcessingJobLog } from '~/composables/useProcessingJobs'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { get, progress: getProgress, logs: getLogs } = useProcessingJobs()

const id = computed(() => Number(route.params.id))
const job = ref<ProcessingJob | null>(null)
const loading = ref(false)
const error = ref('')

const active = computed(() => !!job.value && isActiveJobStatus(job.value.status))
const parameters = computed(() => formatJobParameters(job.value?.parameters))

async function loadJob() {
  loading.value = true
  error.value = ''
  try {
    job.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const details = computed(() => {
  const j = job.value
  if (!j) return []
  return [
    { label: 'Video', value: j.videoTitle ?? `Video #${j.videoId}`, to: `/videos/${j.videoId}`, title: j.videoTitle ?? undefined },
    { label: 'Type', value: jobTypeMeta(j.type).label },
    { label: 'Attempts', value: `${j.attempts} of ${j.maxAttempts}` },
    { label: 'Created', value: formatDateTime(j.createdAt) },
    { label: 'Started', value: j.startedAt ? formatDateTime(j.startedAt) : 'Not yet' },
    { label: 'Finished', value: j.finishedAt ? formatDateTime(j.finishedAt) : '—' },
    { label: 'Last update', value: j.updatedAt ? formatRelativeTime(j.updatedAt) : '—', title: formatDateTime(j.updatedAt) }
  ] as { label: string; value: string; to?: string; title?: string }[]
})

// ── Logs ───────────────────────────────────────────────────────────────────
// Loaded in pages up to MAX_LOG_LINES; beyond that the viewer shows the first
// MAX_LOG_LINES and the Download button is the way to get everything that's loaded.
const MAX_LOG_LINES = 10_000
const PAGE = 1000
const logLines = ref<ProcessingJobLog[]>([])
const logsLoading = ref(false)
const logsTruncated = ref(false)
const lastLogId = computed(() => logLines.value.at(-1)?.id ?? 0)

async function fetchNewLogs() {
  if (logsTruncated.value) return
  logsLoading.value = true
  try {
    for (;;) {
      const batch = await getLogs(id.value, lastLogId.value, PAGE)
      logLines.value.push(...batch)
      if (logLines.value.length >= MAX_LOG_LINES) {
        logsTruncated.value = true
        break
      }
      if (batch.length < PAGE) break
    }
  } catch {
    // Keep what we have; the next poll tries again.
  } finally {
    logsLoading.value = false
  }
  scrollToEndIfFollowing()
}

const LEVEL_RANK: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const LEVEL_CLASS: Record<LogLevel, string> = {
  DEBUG: 'text-gray-500',
  INFO: 'text-sky-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400'
}
const minLevel = ref<LogLevel>('DEBUG')
const levelOptions = [
  { label: 'All levels', value: 'DEBUG' },
  { label: 'Info and up', value: 'INFO' },
  { label: 'Warnings and up', value: 'WARN' },
  { label: 'Errors only', value: 'ERROR' }
]
const logSearch = ref('')
const visibleLines = computed(() => {
  const term = logSearch.value.trim().toLowerCase()
  return logLines.value.filter((l) => LEVEL_RANK[l.level] >= LEVEL_RANK[minLevel.value] && (!term || l.message.toLowerCase().includes(term)))
})

// "12:00:01", or "09-22 12:00:01" once a job's log spans more than one day
// (e.g. a retry the next morning) — otherwise lines from different days would
// look out of order. The full timestamp is always in the tooltip.
const logSpansDays = computed(() => {
  const first = logLines.value[0]?.createdAt.slice(0, 10)
  const last = logLines.value.at(-1)?.createdAt.slice(0, 10)
  return !!first && !!last && first !== last
})
function logTime(value: string) {
  return logSpansDays.value ? `${value.slice(5, 10)} ${value.slice(11, 19)}` : value.slice(11, 19)
}

// Follow = keep the newest line in view. Scrolling up turns it off (you're
// reading something); scrolling back to the bottom turns it back on.
const follow = ref(true)
const logBox = ref<HTMLElement | null>(null)
function onLogScroll() {
  const el = logBox.value
  if (!el) return
  follow.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24
}
function scrollToEndIfFollowing() {
  if (!follow.value) return
  nextTick(() => {
    if (logBox.value) logBox.value.scrollTop = logBox.value.scrollHeight
  })
}
watch(follow, (on) => on && scrollToEndIfFollowing())

async function copyLogs() {
  try {
    await navigator.clipboard.writeText(logsToText(visibleLines.value))
    toast.add({ title: `Copied ${visibleLines.value.length} line(s)`, color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy to the clipboard', color: 'error' })
  }
}

function downloadLogs() {
  const blob = new Blob([logsToText(logLines.value)], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `processing-job-${id.value}.log`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Live updates ───────────────────────────────────────────────────────────
// While the job is active, poll the lightweight /progress endpoint and pull
// only new log lines. When it settles, re-fetch the full job once so the
// allowed actions and timings are final.
const POLL_MS = 2000
let pollTimer: ReturnType<typeof setInterval> | undefined
let polling = false

async function poll() {
  if (!job.value || !active.value || polling || document.visibilityState !== 'visible') return
  polling = true
  try {
    const p = await getProgress(id.value)
    const settled = !isActiveJobStatus(p.status)
    job.value = {
      ...job.value,
      status: p.status,
      progress: p.progress,
      currentStep: p.currentStep,
      errorMessage: p.errorMessage,
      durationSeconds: p.durationSeconds,
      updatedAt: p.updatedAt
    }
    if (p.lastLogId !== null && p.lastLogId > lastLogId.value) await fetchNewLogs()
    if (settled) job.value = await get(id.value)
  } catch {
    // Transient — try again next tick.
  } finally {
    polling = false
  }
}

onMounted(async () => {
  await Promise.all([loadJob(), fetchNewLogs()])
  if (route.hash === '#logs') nextTick(() => document.getElementById('logs')?.scrollIntoView({ behavior: 'smooth' }))
  pollTimer = setInterval(poll, POLL_MS)
})
onBeforeUnmount(() => clearInterval(pollTimer))

// ── Actions ────────────────────────────────────────────────────────────────
const { busy, dialog, request, close, confirm } = useJobActions(async (action, _job, result) => {
  if (action === 'delete') {
    await navigateTo('/processing-jobs')
    return
  }
  if (result) job.value = result
  // Retry/cancel each append a log line ("Re-queued by …", "Cancelled by …").
  await fetchNewLogs()
})
</script>
