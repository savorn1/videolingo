<template>
  <UCard class="mb-4" data-testid="failed-reasons">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Why they failed</h2>
        <UButton
          v-if="canRetry && allRetryable.length"
          size="xs"
          color="primary"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          :loading="retrying === 'all'"
          :disabled="!!retrying"
          @click="retry(allRetryable, 'all')"
        >
          Retry all ({{ allRetryable.length }})
        </UButton>
      </div>
      <USkeleton v-if="loading" class="h-12 w-full" />
      <p v-else-if="error" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
      <p v-else-if="!groups.length" class="text-sm text-gray-500 dark:text-gray-400">No failed jobs.</p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <li v-for="(g, i) in groups.slice(0, 8)" :key="i" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2" data-testid="failed-reason">
          <span class="w-10 shrink-0 text-right text-lg font-bold tabular-nums text-error-600 dark:text-error-400">{{ g.count }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-gray-900 dark:text-white">{{ g.reason }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ g.types.map(typeLabel).join(', ') }}</p>
          </div>
          <UButton
            v-if="canRetry && g.retryable.length"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :loading="retrying === i"
            :disabled="!!retrying"
            @click="retry(g.retryable, i)"
          >
            Retry these ({{ g.retryable.length }})
          </UButton>
        </li>
      </ul>
      <p v-if="total > PAGE" class="text-xs text-gray-500 dark:text-gray-400">From the {{ PAGE }} most recent of {{ total.toLocaleString() }} failed jobs.</p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
// The Failed filter's summary on the processing jobs page: failed jobs grouped by reason (failedJobs.ts), with a
// retry for one reason or all of them. Retrying needs WRITE on processing-jobs, as on each row.
import { failureGroups } from '#shared/utils/failedJobs'
import { JOB_TYPES } from '#shared/utils/processingJobs'

const emit = defineEmits<{ retried: [] }>()
const PAGE = 200
const { list, retry: retryJob } = useProcessingJobs()
const { can } = useAuth()
const toast = useToast()
const canRetry = computed(() => can('processing-jobs', 'WRITE'))

const groups = ref<ReturnType<typeof failureGroups>>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const retrying = ref<number | 'all' | null>(null)
const allRetryable = computed(() => groups.value.flatMap((g) => g.retryable))
const typeLabel = (t: string) => JOB_TYPES.find((x) => x.value === t)?.label ?? t

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await list({ status: 'FAILED', size: PAGE, sortBy: 'id', sortOrder: 'desc' })
    groups.value = failureGroups(res.data)
    total.value = res.metadata.totalCount
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function retry(ids: number[], which: number | 'all') {
  retrying.value = which
  let done = 0
  const failed: string[] = []
  for (const id of ids) {
    try {
      await retryJob(id)
      done++
    } catch (err) {
      failed.push(`#${id}: ${apiErrorMessage(err)}`)
    }
  }
  retrying.value = null
  toast.add({
    title: `${done} job${done === 1 ? '' : 's'} queued again${failed.length ? `, ${failed.length} not` : ''}`,
    description: failed.slice(0, 3).join(' · ') || undefined,
    color: failed.length ? 'warning' : 'success'
  })
  emit('retried')
  await load()
}
</script>
