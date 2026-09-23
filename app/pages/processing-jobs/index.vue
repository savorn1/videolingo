<template>
  <div>
    <PageHeader title="Processing jobs" description="Background work on uploaded videos — transcoding, transcription, translation and subtitles.">
      <template #actions>
        <UBadge v-if="live" color="info" variant="subtle" class="gap-1.5">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-info-400 opacity-75" />
            <span class="relative inline-flex h-2 w-2 rounded-full bg-info-500" />
          </span>
          Live
        </UBadge>
      </template>
    </PageHeader>

    <!-- Status summary — each tile doubles as a one-click status filter. -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      <button
        v-for="s in JOB_STATUSES"
        :key="s.value"
        type="button"
        class="text-left rounded-lg border p-3 transition-colors"
        :class="
          filter.status === s.value
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-500'
            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
        "
        :aria-pressed="filter.status === s.value"
        @click="filter.status = filter.status === s.value ? undefined : s.value"
      >
        <div class="flex items-center justify-between">
          <StatusBadge :status="s.value" />
        </div>
        <!-- A div, not a <p>: the skeleton is a block element, and a div inside
             a <p> is invalid HTML that the browser re-parses, which broke hydration. -->
        <div class="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
          <USkeleton v-if="!counts" class="h-7 w-10" />
          <template v-else>{{ (counts[s.value] ?? 0).toLocaleString() }}</template>
        </div>
      </button>
    </div>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Job # or video title" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.type" :items="typeFilterOptions" placeholder="Type" class="w-48" />
        <div class="flex items-center gap-2">
          <UInput v-model="filter.createdFrom" type="date" aria-label="Created from" class="w-40" :max="filter.createdTo" />
          <span class="text-sm text-gray-400">–</span>
          <UInput v-model="filter.createdTo" type="date" aria-label="Created to" class="w-40" :min="filter.createdFrom" />
        </div>
        <UBadge v-if="filter.videoId" color="neutral" variant="subtle" size="lg" class="gap-1">
          Video #{{ filter.videoId }}
          <UButton
            size="xs"
            color="neutral"
            variant="link"
            icon="i-lucide-x"
            aria-label="Remove video filter"
            :padded="false"
            @click="filter.videoId = undefined"
          />
        </UBadge>
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        :rows="rows"
        :columns="columns"
        :loading="loading && !rows.length"
        refreshable
        exportable
        export-filename="processing-jobs"
        @refresh="refreshAll"
        @select="(row: ProcessingJob) => navigateTo(`/processing-jobs/${row.id}`)"
      >
        <template #id-data="{ row }">
          <span class="font-mono text-xs text-gray-500">#{{ row.id }}</span>
        </template>

        <template #type-data="{ row }">
          <div class="flex items-center gap-2 whitespace-nowrap">
            <UIcon :name="jobTypeMeta(row.type).icon" class="w-4 h-4 text-gray-400" />
            {{ jobTypeMeta(row.type).label }}
          </div>
        </template>

        <template #videoTitle-data="{ row }">
          <NuxtLink
            :to="`/videos/${row.videoId}`"
            class="block max-w-44 truncate text-primary-600 dark:text-primary-400 hover:underline"
            :title="row.videoTitle ?? undefined"
            @click.stop
          >
            {{ row.videoTitle ?? `Video #${row.videoId}` }}
          </NuxtLink>
        </template>

        <template #createdAt-data="{ row }">
          <span class="whitespace-nowrap" :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
        </template>

        <template #status-data="{ row }">
          <div class="w-40 space-y-1.5">
            <StatusBadge :status="row.status" />
            <JobProgress :status="row.status" :progress="row.progress" :current-step="row.status === 'FAILED' ? row.errorMessage : row.currentStep" />
          </div>
        </template>

        <template #actions-data="{ row }">
          <div class="min-w-max" @click.stop>
            <RowActions :actions="rowActions(row)" :max="1" />
          </div>
        </template>

        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No jobs match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-cpu" title="No processing jobs yet" description="Jobs appear here as uploaded videos are processed." />
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

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
import type { ColumnDef, RowAction } from '#shared/types'
import type { JobStatus, JobType } from '#shared/utils/processingJobs'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

definePageMeta({ middleware: 'admin' })

const { list, summary } = useProcessingJobs()

const rows = ref<ProcessingJob[]>([])
const total = ref(0)
const counts = ref<Record<JobStatus, number> | null>(null)
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  status: JobStatus | undefined
  type: JobType | undefined
  videoId: number | undefined
  createdFrom: string | undefined
  createdTo: string | undefined
}>({ status: undefined, type: undefined, videoId: undefined, createdFrom: undefined, createdTo: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(15)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'id', direction: 'desc' })

useListQuerySync({ filter, search, page })

const typeFilterOptions = [{ label: 'All types', value: undefined }, ...JOB_TYPES.map((t) => ({ label: t.label, value: t.value, icon: t.icon }))]

const columns: ColumnDef<ProcessingJob>[] = [
  { key: 'id', label: 'Job', sortable: true },
  { key: 'type', sortable: true, value: (row) => jobTypeMeta(row.type).label },
  { key: 'videoTitle', label: 'Video', value: (row) => row.videoTitle ?? `Video #${row.videoId}` },
  // Status and progress share one column (badge over bar); the export still gets both.
  { key: 'status', sortable: true, value: (row) => `${formatEnum(row.status)} (${row.progress}%)` },
  { key: 'attempts', sortable: true, class: 'tabular-nums', value: (row) => `${row.attempts} / ${row.maxAttempts}` },
  { key: 'durationSeconds', label: 'Duration', class: 'tabular-nums', value: (row) => formatDuration(row.durationSeconds) },
  { key: 'createdAt', label: 'Created', sortable: true, value: (row) => formatDateTime(row.createdAt) },
  { key: 'actions', label: '' }
]

// `silent` refreshes (auto-poll) keep the current rows on screen and skip the
// loading state, so the table doesn't flash every few seconds.
let requestSeq = 0
async function load(silent = false) {
  const seq = ++requestSeq
  if (!silent) loading.value = true
  if (!silent) error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      status: filter.status,
      type: filter.type,
      videoId: filter.videoId,
      createdFrom: filter.createdFrom || undefined,
      createdTo: filter.createdTo || undefined,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      page: page.value,
      size: pageSize.value
    })
    if (seq !== requestSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
    error.value = ''
  } catch (err) {
    if (seq === requestSeq && !silent) error.value = apiErrorMessage(err)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadSummary() {
  try {
    counts.value = await summary()
  } catch {
    // Tiles just keep their last values; the table shows any real error.
  }
}

function refreshAll() {
  load()
  loadSummary()
}

const debouncedSearch = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})
watch([() => ({ ...filter }), debouncedSearch, sort, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], () => load())

const hasActiveFilter = computed(
  () => search.value !== '' || !!filter.status || !!filter.type || filter.videoId !== undefined || !!filter.createdFrom || !!filter.createdTo
)

function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.status = undefined
  filter.type = undefined
  filter.videoId = undefined
  filter.createdFrom = undefined
  filter.createdTo = undefined
}

// ── Live refresh ───────────────────────────────────────────────────────────
// Poll only while something could still change on its own (any queued or
// running job anywhere), and never while the browser tab is hidden.
const POLL_MS = 4000
const live = computed(() => !!counts.value && (counts.value.QUEUED > 0 || counts.value.RUNNING > 0))
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  refreshAll()
  pollTimer = setInterval(() => {
    if (!live.value || document.visibilityState !== 'visible') return
    load(true)
    loadSummary()
  }, POLL_MS)
})
onBeforeUnmount(() => clearInterval(pollTimer))

// ── Actions ────────────────────────────────────────────────────────────────
const { busy, dialog, request, close, confirm } = useJobActions(() => refreshAll())

function rowActions(row: ProcessingJob): RowAction[] {
  const actions: RowAction[] = []
  if (row.canRetry) actions.push({ label: 'Retry', icon: 'i-lucide-rotate-ccw', color: 'primary', onClick: () => request(row, 'retry') })
  if (row.canCancel) actions.push({ label: 'Cancel', icon: 'i-lucide-circle-stop', color: 'warning', onClick: () => request(row, 'cancel') })
  actions.push(
    { label: 'Details', icon: 'i-lucide-eye', onClick: () => navigateTo(`/processing-jobs/${row.id}`) },
    { label: 'Logs', icon: 'i-lucide-scroll-text', onClick: () => navigateTo(`/processing-jobs/${row.id}#logs`) }
  )
  if (row.canDelete) actions.push({ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => request(row, 'delete') })
  return actions
}
</script>
