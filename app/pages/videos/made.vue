<template>
  <div>
    <PageHeader title="Videos being made" :description="summary" :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Videos being made' }]">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-list" to="/videos">All videos</UButton>
      </template>
    </PageHeader>

    <UAlert
      v-if="!canRead"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="They keep going in the background"
      description="You can't see processing jobs; the videos appear in the list (hidden) as they're made."
    />
    <UAlert v-else-if="!ids.length" color="neutral" variant="subtle" icon="i-lucide-info" title="Nothing to follow here" />

    <template v-else>
      <UProgress :model-value="overall" class="mb-4" :color="counts.failed ? 'warning' : 'primary'" aria-label="Overall progress" />
      <p v-if="!counts.active" class="mb-4 text-sm text-gray-700 dark:text-gray-300" role="status">
        {{ counts.failed ? 'Finished, with some failures — retry them below.' : 'All done. Review each video, then enable it for learners.' }}
      </p>
      <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800" data-testid="batch-jobs">
        <li v-for="id in ids" :key="id" class="space-y-1.5 px-4 py-3">
          <template v-if="jobs[id]">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <NuxtLink :to="`/videos/${jobs[id]!.videoId}`" class="min-w-0 flex-1 truncate font-medium text-gray-900 hover:underline dark:text-white">
                {{ jobs[id]!.videoTitle ?? `Video #${jobs[id]!.videoId}` }}
              </NuxtLink>
              <StatusBadge :status="jobs[id]!.status" />
              <UButton
                v-if="jobs[id]!.status === 'FAILED' && jobs[id]!.canRetry && canRetry"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                :loading="retrying === id"
                @click="onRetry(id)"
              >
                Retry
              </UButton>
            </div>
            <UProgress v-if="isActiveJobStatus(jobs[id]!.status)" :model-value="jobs[id]!.progress" size="xs" />
            <p v-if="jobs[id]!.errorMessage && jobs[id]!.status === 'FAILED'" class="text-sm text-error-600 dark:text-error-400">
              {{ jobs[id]!.errorMessage }}
            </p>
            <p v-else-if="isActiveJobStatus(jobs[id]!.status)" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {{ jobs[id]!.status === 'QUEUED' ? 'Waiting for its turn' : (jobs[id]!.currentStep ?? 'Working') }} · {{ jobs[id]!.progress }}%
            </p>
          </template>
          <p v-else-if="missing.has(id)" class="text-sm text-gray-500 dark:text-gray-400">Job #{{ id }} could not be loaded.</p>
          <USkeleton v-else class="h-5 w-1/2" />
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
// Follows the videos a batch on "Video from audio" is making: each job's state and progress, polled every
// 3 s while any is still going, with Retry for the ones that failed.
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import { batchCounts, batchSummary, parseJobIds } from '#shared/utils/batchProgress'
import { isActiveJobStatus } from '#shared/utils/processingJobs'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const jobsApi = useProcessingJobs()
const { can } = useAuth()
const canRead = computed(() => can('processing-jobs', 'READ'))
const canRetry = computed(() => can('processing-jobs', 'WRITE'))

const ids = computed(() => parseJobIds(route.query.jobs))
const jobs = ref<Record<number, ProcessingJob>>({})
const missing = ref(new Set<number>())
const retrying = ref<number | null>(null)

const counts = computed(() => batchCounts(ids.value.map((id) => (missing.value.has(id) ? 'FAILED' : (jobs.value[id]?.status ?? null)))))
const summary = computed(() => (canRead.value ? batchSummary(counts.value) : undefined))
/** The batch's progress: each job's share, finished ones (either way) counting in full. */
const overall = computed(() => {
  if (!ids.value.length) return 0
  const sum = ids.value.reduce((n, id) => {
    const j = jobs.value[id]
    return n + (!j ? (missing.value.has(id) ? 100 : 0) : isActiveJobStatus(j.status) ? j.progress : 100)
  }, 0)
  return Math.round(sum / ids.value.length)
})

async function refresh() {
  const todo = ids.value.filter((id) => !missing.value.has(id) && (!jobs.value[id] || isActiveJobStatus(jobs.value[id]!.status)))
  await Promise.all(
    todo.map(async (id) => {
      try {
        jobs.value[id] = await jobsApi.get(id)
      } catch {
        missing.value.add(id)
      }
    })
  )
}

let timer: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  if (!canRead.value) return
  await refresh()
  timer = setInterval(() => {
    if (counts.value.active) refresh()
  }, 3000)
})
onBeforeUnmount(() => clearInterval(timer))

async function onRetry(id: number) {
  retrying.value = id
  try {
    jobs.value[id] = await jobsApi.retry(id)
  } catch (err) {
    toast.add({ title: 'Could not retry', description: apiErrorMessage(err), color: 'error' })
  } finally {
    retrying.value = null
  }
}
</script>
