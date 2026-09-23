<template>
  <div>
    <PageHeader title="Transcripts" description="Timed text for each video — the spoken-language transcript and its translations.">
      <template #actions>
        <UButton icon="i-lucide-plus" @click="showCreate = true">New transcript</UButton>
      </template>
    </PageHeader>

    <UTabs v-model="view" :items="viewItems" :content="false" class="mb-4 w-full sm:w-96" />

    <!-- ── All transcripts ─────────────────────────────────────────────── -->
    <template v-if="view === 'list'">
      <UCard class="mb-4">
        <div class="flex flex-wrap gap-3">
          <UInput v-model="search" placeholder="Search video title" icon="i-lucide-search" class="w-64" />
          <USelect v-model="filter.language" :items="languageFilterOptions" placeholder="Language" class="w-40" />
          <USelect v-model="filter.source" :items="sourceFilterOptions" placeholder="Source" class="w-40" />
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
          export-filename="transcripts"
          @refresh="load"
          @select="(row: Transcript) => navigateTo(`/transcripts/${row.id}`)"
        >
          <template #videoTitle-data="{ row }">
            <div class="min-w-0 max-w-xs">
              <p class="font-semibold text-gray-900 dark:text-white truncate" :title="row.videoTitle ?? undefined">
                {{ row.videoTitle ?? `Video #${row.videoId}` }}
              </p>
              <p class="text-xs text-gray-500">#{{ row.id }}</p>
            </div>
          </template>

          <template #language-data="{ row }">
            <div class="flex items-center gap-1.5 whitespace-nowrap">
              {{ languageLabel(row.language) }}
              <UBadge v-if="row.videoLanguage && row.language !== row.videoLanguage" size="sm" color="neutral" variant="outline">Translation</UBadge>
            </div>
          </template>

          <template #source-data="{ row }">
            <div class="flex items-center gap-1.5 whitespace-nowrap">
              <UBadge :color="sourceMeta(row.source).color" variant="subtle" :icon="sourceMeta(row.source).icon">{{ sourceMeta(row.source).label }}</UBadge>
              <UTooltip v-if="row.lastJobStatus && isActiveJobStatus(row.lastJobStatus)" :text="`Regenerating — job #${row.lastJobId}`">
                <UIcon name="i-lucide-loader-circle" class="w-4 h-4 text-info-500 animate-spin" />
              </UTooltip>
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
              title="No transcripts match your filters"
              description="Try a different search or clear your filters."
            >
              <template #action>
                <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
              </template>
            </EmptyState>
            <EmptyState
              v-else
              icon="i-lucide-captions"
              title="No transcripts yet"
              description="Create one by hand, import a subtitle file, or let processing generate it."
            >
              <template #action>
                <UButton icon="i-lucide-plus" @click="showCreate = true">New transcript</UButton>
              </template>
            </EmptyState>
          </template>
        </DataTable>

        <div v-if="total > 0" class="pt-4">
          <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
        </div>
      </UCard>
    </template>

    <!-- ── Full-text search across every transcript ────────────────────── -->
    <template v-else>
      <UCard class="mb-4">
        <div class="flex flex-wrap gap-3">
          <UInput v-model="textQuery" placeholder="Search words or phrases in any transcript…" icon="i-lucide-text-search" class="w-full sm:w-96" autofocus />
          <USelect v-model="textLanguage" :items="languageFilterOptions" placeholder="Language" class="w-40" />
        </div>
      </UCard>

      <UCard>
        <p v-if="debouncedTextQuery.trim().length < 2" class="text-sm text-gray-500 dark:text-gray-400">
          Type at least 2 characters to search every transcript's text.
        </p>
        <template v-else>
          <UAlert v-if="hitsError" color="error" variant="subtle" class="mb-3" :title="hitsError" icon="i-lucide-triangle-alert" />
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            <template v-if="hitsLoading && !hits.length">Searching…</template>
            <template v-else>{{ hitsTotal.toLocaleString() }} matching segment{{ hitsTotal === 1 ? '' : 's' }}</template>
          </p>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            <li v-for="hit in hits" :key="hit.segmentId">
              <NuxtLink
                :to="{ path: `/transcripts/${hit.transcriptId}`, query: { q: debouncedTextQuery.trim(), t: hit.startMs } }"
                class="flex gap-4 py-3 px-2 -mx-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span class="shrink-0 w-20 font-mono text-xs text-gray-500 pt-0.5 tabular-nums">{{ formatTimestamp(hit.startMs) }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm text-gray-900 dark:text-white whitespace-pre-line">
                    <template v-for="(part, i) in splitHighlight(hit.text, debouncedTextQuery)" :key="i">
                      <mark v-if="part.match" class="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">{{ part.text }}</mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </span>
                  <span class="block text-xs text-gray-500 mt-0.5 truncate">{{ hit.videoTitle }} · {{ languageLabel(hit.language) }}</span>
                </span>
              </NuxtLink>
            </li>
          </ul>
          <EmptyState
            v-if="!hitsLoading && !hits.length && !hitsError"
            icon="i-lucide-search-x"
            title="No matches"
            description="Try a shorter phrase, or a different language filter."
          />
          <div v-if="hitsTotal > hitsPageSize" class="pt-4">
            <DataPagination v-model:page="hitsPage" v-model:page-size="hitsPageSize" :total="hitsTotal" />
          </div>
        </template>
      </UCard>
    </template>

    <TranscriptCreateModal v-model="showCreate" :default-video-id="filter.videoId" @created="(t) => navigateTo(`/transcripts/${t.id}`)" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete transcript"
      :description="`Delete the ${languageLabel(confirmDelete?.language)} transcript of '${confirmDelete?.videoTitle ?? ''}' (${confirmDelete?.segmentCount ?? 0} segments)? This cannot be undone.`"
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
import { EXPORT_FORMATS, TRANSCRIPT_SOURCES, type Transcript, type TranscriptSearchHit, type TranscriptSource } from '~/composables/useTranscripts'

definePageMeta({ middleware: 'admin' })

const { list, remove, regenerate, search: searchText, exportFile } = useTranscripts()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const showCreate = ref(false)

const viewItems = [
  { label: 'All transcripts', value: 'list', icon: 'i-lucide-captions' },
  { label: 'Search text', value: 'search', icon: 'i-lucide-text-search' }
]
const view = computed({
  get: () => (route.query.view === 'search' ? 'search' : 'list'),
  set: (value: string | number) => router.replace({ query: { ...route.query, view: value === 'search' ? 'search' : undefined } })
})

function sourceMeta(source: TranscriptSource) {
  return TRANSCRIPT_SOURCES.find((s) => s.value === source) ?? TRANSCRIPT_SOURCES[1]!
}

// ── List ───────────────────────────────────────────────────────────────────
const rows = ref<Transcript[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ language: string | undefined; source: TranscriptSource | undefined; videoId: number | undefined }>({
  language: undefined,
  source: undefined,
  videoId: undefined
})
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'updatedAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const languageFilterOptions = computed(() => [{ label: 'All languages', value: undefined }, ...languageOptions(filter.language)])
const sourceFilterOptions = [{ label: 'All sources', value: undefined }, ...TRANSCRIPT_SOURCES.map((s) => ({ label: s.label, value: s.value }))]

const columns: ColumnDef<Transcript>[] = [
  { key: 'videoTitle', label: 'Video', value: (row) => row.videoTitle ?? `Video #${row.videoId}` },
  { key: 'language', sortable: true, value: (row) => languageLabel(row.language) },
  { key: 'source', sortable: true, value: (row) => sourceMeta(row.source).label },
  { key: 'segmentCount', label: 'Segments', type: 'number', sortable: true, class: 'tabular-nums' },
  { key: 'wordCount', label: 'Words', type: 'number', sortable: true, class: 'tabular-nums' },
  { key: 'durationMs', label: 'Length', sortable: true, class: 'tabular-nums', value: (row) => formatDuration(row.durationMs / 1000) },
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
      language: filter.language,
      source: filter.source,
      videoId: filter.videoId,
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

const hasActiveFilter = computed(() => search.value !== '' || !!filter.language || !!filter.source || filter.videoId !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.language = undefined
  filter.source = undefined
  filter.videoId = undefined
}

onMounted(() => {
  load()
  if (view.value === 'search') runTextSearch()
})

// ── Row actions ────────────────────────────────────────────────────────────
const busy = ref(false)
const confirmDelete = ref<Transcript | null>(null)

function rowActions(row: Transcript): RowAction[] {
  const regenerating = !!row.lastJobStatus && isActiveJobStatus(row.lastJobStatus)
  return [
    { label: 'Open', icon: 'i-lucide-captions', color: 'primary', onClick: () => navigateTo(`/transcripts/${row.id}`) },
    { label: 'Edit', icon: 'i-lucide-pencil', onClick: () => navigateTo(`/transcripts/${row.id}?edit=1`) },
    ...EXPORT_FORMATS.map((f) => ({ label: `Export ${f.label}`, icon: 'i-lucide-download', onClick: () => onExport(row, f.value) })),
    regenerating
      ? { label: `View job #${row.lastJobId}`, icon: 'i-lucide-cpu', onClick: () => navigateTo(`/processing-jobs/${row.lastJobId}`) }
      : { label: 'Regenerate', icon: 'i-lucide-refresh-cw', onClick: () => onRegenerate(row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

async function onExport(row: Transcript, format: (typeof EXPORT_FORMATS)[number]['value']) {
  try {
    const name = await exportFile(row.id, format)
    toast.add({ title: `Downloaded ${name}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Export failed', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onRegenerate(row: Transcript) {
  try {
    const job = await regenerate(row.id)
    toast.add({
      title: `Regeneration queued — job #${job.id}`,
      description: 'The transcript is replaced when the job finishes.',
      color: 'success',
      actions: [{ label: 'View job', onClick: () => navigateTo(`/processing-jobs/${job.id}`) }]
    })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not regenerate', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDelete(row: Transcript) {
  busy.value = true
  try {
    await remove(row.id)
    toast.add({ title: 'Transcript deleted', color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete transcript', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ── Full-text search ───────────────────────────────────────────────────────
// ?text= (not ?q=, which the list's own title search owns via useListQuerySync).
const textQuery = ref(typeof route.query.text === 'string' ? route.query.text : '')
const debouncedTextQuery = ref(textQuery.value)
const textLanguage = ref<string | undefined>()
const hits = ref<TranscriptSearchHit[]>([])
const hitsTotal = ref(0)
const hitsPage = ref(1)
const hitsPageSize = ref(15)
const hitsLoading = ref(false)
const hitsError = ref('')

let textTimer: ReturnType<typeof setTimeout> | undefined
watch(textQuery, (value) => {
  clearTimeout(textTimer)
  textTimer = setTimeout(() => (debouncedTextQuery.value = value), 350)
})
watch([debouncedTextQuery, textLanguage, hitsPageSize], () => {
  hitsPage.value = 1
})
// Keep the search in the URL so a result can be opened and come back to.
watch(debouncedTextQuery, (text) => router.replace({ query: { ...route.query, text: text.trim() || undefined } }))

let hitsSeq = 0
async function runTextSearch() {
  const q = debouncedTextQuery.value.trim()
  if (q.length < 2) {
    hits.value = []
    hitsTotal.value = 0
    return
  }
  const seq = ++hitsSeq
  hitsLoading.value = true
  hitsError.value = ''
  try {
    const res = await searchText({ q, language: textLanguage.value, page: hitsPage.value, size: hitsPageSize.value })
    if (seq !== hitsSeq) return
    hits.value = res.data
    hitsTotal.value = res.metadata.totalCount
  } catch (err) {
    if (seq === hitsSeq) hitsError.value = apiErrorMessage(err)
  } finally {
    if (seq === hitsSeq) hitsLoading.value = false
  }
}
watch([debouncedTextQuery, textLanguage, hitsPage, hitsPageSize], runTextSearch)
watch(view, (v) => v === 'search' && runTextSearch())
</script>
