<template>
  <div>
    <PageHeader
      title="Subtitles"
      description="Display-ready subtitle tracks — generated from transcripts, uploaded, or written by hand — and which ones learners see."
    >
      <template #actions>
        <UButton icon="i-lucide-plus" @click="showCreate = true">New track</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search video or label" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.language" :items="languageFilterOptions" placeholder="Language" class="w-40" />
        <USelect v-model="filter.source" :items="sourceFilterOptions" placeholder="Source" class="w-40" />
        <USelect v-model="filter.published" :items="publishedFilterOptions" placeholder="Visibility" class="w-40" />
        <USelect v-model="filter.hasIssues" :items="issueFilterOptions" placeholder="Readability" class="w-44" />
        <USelect v-model="filter.reviewStatus" :items="reviewFilterOptions" placeholder="Review" class="w-44" />
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
        :loading="loading"
        refreshable
        exportable
        export-filename="subtitles"
        @refresh="load"
        @select="(row: Subtitle) => navigateTo(`/subtitles/${row.id}`)"
      >
        <template #label-data="{ row }">
          <div class="min-w-0 max-w-xs">
            <div class="flex items-center gap-1.5">
              <p class="font-semibold text-gray-900 dark:text-white truncate">{{ row.label }}</p>
              <UBadge v-if="row.isDefault" color="primary" variant="subtle" size="sm" icon="i-lucide-star">Default</UBadge>
            </div>
            <p class="text-xs text-gray-500 truncate" :title="row.videoTitle ?? undefined">{{ row.videoTitle ?? `Video #${row.videoId}` }}</p>
          </div>
        </template>

        <template #language-data="{ row }">
          <div class="flex items-center gap-1.5 whitespace-nowrap">
            {{ languageLabel(row.language) }}
            <UBadge v-if="row.kind === 'CAPTIONS'" size="sm" color="neutral" variant="outline">CC</UBadge>
          </div>
        </template>

        <template #source-data="{ row }">
          <UBadge :color="sourceMeta(row.source).color" variant="subtle" :icon="sourceMeta(row.source).icon">{{ sourceMeta(row.source).label }}</UBadge>
        </template>

        <template #reviewStatus-data="{ row }">
          <StatusBadge :status="row.reviewStatus" />
        </template>
        <template #published-data="{ row }">
          <UBadge :color="row.published ? 'success' : 'neutral'" variant="subtle" :icon="row.published ? 'i-lucide-eye' : 'i-lucide-eye-off'">
            {{ row.published ? 'Published' : 'Unpublished' }}
          </UBadge>
        </template>

        <template #issueCount-data="{ row }">
          <UBadge v-if="row.issueCount" color="warning" variant="subtle" icon="i-lucide-triangle-alert">{{ row.issueCount }}</UBadge>
          <UIcon v-else-if="row.cueCount" name="i-lucide-circle-check" class="w-4 h-4 text-success-500" />
          <span v-else class="text-gray-400">—</span>
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
            title="No tracks match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            icon="i-lucide-subtitles"
            title="No subtitle tracks yet"
            description="Generate one from a transcript, or upload an .srt/.vtt file."
          >
            <template #action>
              <UButton icon="i-lucide-plus" @click="showCreate = true">New track</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <SubtitleCreateModal v-model="showCreate" :default-video-id="filter.videoId" @created="onCreated" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete subtitle track"
      :description="`Delete '${confirmDelete?.label ?? ''}' (${confirmDelete?.cueCount ?? 0} cues) from '${confirmDelete?.videoTitle ?? ''}'?${confirmDelete?.published ? ' Learners will stop seeing it immediately.' : ''} This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import { REVIEW_STATUSES, SUBTITLE_SOURCES, type ReviewStatus, type Subtitle, type SubtitleFormat, type SubtitleSource } from '~/composables/useSubtitles'

definePageMeta({ middleware: 'admin' })

const { list, update, setDefault, remove, download } = useSubtitles()
const toast = useToast()

const showCreate = ref(false)
const rows = ref<Subtitle[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  language: string | undefined
  source: SubtitleSource | undefined
  published: boolean | undefined
  hasIssues: boolean | undefined
  reviewStatus: ReviewStatus | undefined
  videoId: number | undefined
}>({ language: undefined, source: undefined, published: undefined, hasIssues: undefined, reviewStatus: undefined, videoId: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'updatedAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const languageFilterOptions = computed(() => [{ label: 'All languages', value: undefined }, ...languageOptions(filter.language)])
const sourceFilterOptions = [{ label: 'All sources', value: undefined }, ...SUBTITLE_SOURCES.map((s) => ({ label: s.label, value: s.value }))]
const publishedFilterOptions = [
  { label: 'All', value: undefined },
  { label: 'Published', value: true },
  { label: 'Unpublished', value: false }
]
const reviewFilterOptions = [{ label: 'Any review status', value: undefined }, ...REVIEW_STATUSES]
const issueFilterOptions = [
  { label: 'Any readability', value: undefined },
  { label: 'Has warnings', value: true },
  { label: 'No warnings', value: false }
]

function sourceMeta(source: SubtitleSource) {
  return SUBTITLE_SOURCES.find((s) => s.value === source) ?? SUBTITLE_SOURCES[2]!
}

const columns: ColumnDef<Subtitle>[] = [
  { key: 'label', label: 'Track', sortable: true },
  { key: 'language', sortable: true, value: (row) => languageLabel(row.language) },
  { key: 'source', sortable: true, value: (row) => sourceMeta(row.source).label },
  { key: 'reviewStatus', label: 'Review', sortable: true, value: (row) => REVIEW_STATUSES.find((r) => r.value === row.reviewStatus)?.label ?? row.reviewStatus },
  { key: 'published', label: 'Visibility', sortable: true, value: (row) => (row.published ? 'Published' : 'Unpublished') },
  { key: 'cueCount', label: 'Cues', type: 'number', sortable: true, class: 'tabular-nums' },
  { key: 'issueCount', label: 'Warnings', sortable: true, value: (row) => String(row.issueCount) },
  { key: 'updatedAt', label: 'Updated', type: 'datetime', sortable: true },
  { key: 'actions', label: '' }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      ...filter,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      page: page.value,
      size: pageSize.value
    })
    if (seq !== requestSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
  } catch (err) {
    if (seq === requestSeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
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
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], load)

const hasActiveFilter = computed(
  () =>
    search.value !== '' ||
    !!filter.language ||
    !!filter.source ||
    filter.published !== undefined ||
    filter.hasIssues !== undefined ||
    filter.reviewStatus !== undefined ||
    filter.videoId !== undefined
)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  Object.assign(filter, { language: undefined, source: undefined, published: undefined, hasIssues: undefined, reviewStatus: undefined, videoId: undefined })
}

onMounted(load)

function onCreated(created: Subtitle) {
  if (created.warnings?.length) {
    toast.add({
      title: `Uploaded with ${created.warnings.length} cue(s) skipped`,
      description: created.warnings.slice(0, 3).join(' · '),
      color: 'warning'
    })
  }
  navigateTo(`/subtitles/${created.id}`)
}

// ── Row actions ────────────────────────────────────────────────────────────
const busy = ref(false)
const confirmDelete = ref<Subtitle | null>(null)

function rowActions(row: Subtitle): RowAction[] {
  const actions: RowAction[] = [
    { label: 'Preview', icon: 'i-lucide-play', color: 'primary', onClick: () => navigateTo(`/subtitles/${row.id}`) },
    { label: 'Edit cues', icon: 'i-lucide-pencil', onClick: () => navigateTo(`/subtitles/${row.id}?edit=1`) },
    row.published
      ? { label: 'Unpublish', icon: 'i-lucide-eye-off', onClick: () => setPublished(row, false) }
      : { label: 'Publish', icon: 'i-lucide-eye', color: 'success', onClick: () => setPublished(row, true) }
  ]
  if (row.published && !row.isDefault) actions.push({ label: 'Make default', icon: 'i-lucide-star', onClick: () => makeDefault(row) })
  if (row.transcriptId) actions.push({ label: 'Regenerate', icon: 'i-lucide-refresh-cw', onClick: () => navigateTo(`/subtitles/${row.id}?regenerate=1`) })
  actions.push(
    { label: 'Download .vtt', icon: 'i-lucide-download', onClick: () => onDownload(row, 'vtt') },
    { label: 'Download .srt', icon: 'i-lucide-download', onClick: () => onDownload(row, 'srt') },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  )
  return actions
}

async function run(action: () => Promise<unknown>, success: string, failure: string) {
  busy.value = true
  try {
    await action()
    toast.add({ title: success, color: 'success' })
    await load()
    return true
  } catch (err) {
    toast.add({ title: failure, description: apiErrorMessage(err), color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}

function setPublished(row: Subtitle, published: boolean) {
  return run(
    () => update(row.id, { version: row.version, label: row.label, language: row.language, kind: row.kind, published, rules: row.rules }),
    published ? `${row.label} published` : `${row.label} unpublished${row.isDefault ? ' (no longer the default)' : ''}`,
    'Could not change visibility'
  )
}

function makeDefault(row: Subtitle) {
  return run(() => setDefault(row.id), `${row.label} is now the default for this video`, 'Could not set default')
}

async function onDownload(row: Subtitle, format: SubtitleFormat) {
  try {
    const name = await download(row.id, format)
    toast.add({ title: `Downloaded ${name}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Download failed', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDelete(row: Subtitle) {
  if (await run(() => remove(row.id), 'Subtitle track deleted', 'Could not delete track')) confirmDelete.value = null
}
</script>
