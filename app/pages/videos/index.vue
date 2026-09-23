<template>
  <div>
    <PageHeader title="Videos" description="Learning videos uploaded to VideoLingo." />

    <UTabs v-model="view" :items="viewItems" :content="false" class="mb-4 w-full sm:w-80" />

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search title or description" icon="i-lucide-search" class="w-64" />
        <USelect v-if="!filter.deleted" v-model="filter.enabled" :items="statusFilterOptions" placeholder="Status" class="w-36" />
        <USelect v-model="filter.language" :items="languageFilterOptions" placeholder="Language" class="w-40" />
        <USelect v-model="filter.categoryId" :items="categoryFilterOptions" placeholder="Category" class="w-44" />
        <USelectMenu
          v-model="filter.ownerId"
          :items="ownerFilterOptions"
          value-key="value"
          placeholder="Owner"
          :search-input="{ placeholder: 'Search users…' }"
          class="w-44"
        />
        <div class="flex items-center gap-2">
          <UInput v-model="filter.createdFrom" type="date" aria-label="Uploaded from" class="w-40" :max="filter.createdTo" />
          <span class="text-sm text-gray-400">–</span>
          <UInput v-model="filter.createdTo" type="date" aria-label="Uploaded to" class="w-40" :min="filter.createdFrom" />
        </div>
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
        :export-filename="filter.deleted ? 'videos-trash' : 'videos'"
        @refresh="load"
        @select="(row: Video) => navigateTo(`/videos/${row.id}`)"
      >
        <template #title-data="{ row }">
          <div class="flex items-center gap-3 min-w-0 max-w-xs">
            <div class="relative w-24 aspect-video shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                v-if="row.thumbnailUrl && !brokenThumbnails.has(row.id)"
                :src="row.thumbnailUrl"
                alt=""
                class="w-full h-full object-cover"
                loading="lazy"
                @error="brokenThumbnails.add(row.id)"
              />
              <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-5 h-5 text-gray-400" />
              <span
                v-if="row.durationSeconds !== null"
                class="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-semibold text-white tabular-nums"
              >
                {{ formatDuration(row.durationSeconds) }}
              </span>
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 dark:text-white truncate" :title="row.title">{{ row.title }}</p>
              <p v-if="row.description" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ row.description }}</p>
              <div v-if="row.categories.length" class="flex flex-wrap gap-1 mt-1">
                <CategoryBadge v-for="c in row.categories" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
              </div>
            </div>
          </div>
        </template>

        <template #ownerUsername-data="{ row }">
          <NuxtLink v-if="row.ownerUsername" :to="`/users/${row.ownerId}`" class="text-primary-600 dark:text-primary-400 hover:underline" @click.stop>
            {{ row.ownerUsername }}
          </NuxtLink>
          <span v-else class="text-gray-400">{{ row.ownerId ? 'Deleted user' : '—' }}</span>
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
            title="No videos match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else-if="filter.deleted"
            icon="i-lucide-trash-2"
            title="Trash is empty"
            description="Deleted videos show up here and can be restored."
          />
          <EmptyState v-else icon="i-lucide-clapperboard" title="No videos yet" description="Videos appear here once learners or creators upload them." />
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <VideoEditModal v-model="showEdit" :video="editing" @saved="load" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Move to trash"
      :description="`Move '${confirmDelete?.title ?? ''}' to the trash? It stops being available right away, and you can restore it from the Trash tab.`"
      confirm-label="Move to trash"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
    <ConfirmModal
      :model-value="confirmDisable !== null"
      title="Disable video"
      :description="`Disable '${confirmDisable?.title ?? ''}'? Learners can no longer watch it until it's enabled again.`"
      confirm-label="Disable"
      color="warning"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && (confirmDisable = null)"
      @confirm="confirmDisable && setStatus(confirmDisable, false)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { Video } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const { list, updateStatus, remove, restore } = useVideos()
const { list: listUsers } = useUsers()
const toast = useToast()

const rows = ref<Video[]>([])
// Thumbnails whose URL failed to load — shown as the placeholder icon instead
// of the browser's broken-image glyph.
const brokenThumbnails = reactive(new Set<number>())
const total = ref(0)
const loading = ref(false)
const error = ref('')

// ── Filters (server-side) ──────────────────────────────────────────────────
const filter = reactive<{
  deleted: boolean
  enabled: boolean | undefined
  language: string | undefined
  categoryId: number | undefined
  ownerId: number | undefined
  createdFrom: string | undefined
  createdTo: string | undefined
}>({
  deleted: false,
  enabled: undefined,
  language: undefined,
  categoryId: undefined,
  ownerId: undefined,
  createdFrom: undefined,
  createdTo: undefined
})
const search = ref('')
const page = ref(1)
const pageSize = ref(10)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'createdAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const viewItems = [
  { label: 'Videos', value: 'active', icon: 'i-lucide-clapperboard' },
  { label: 'Trash', value: 'trash', icon: 'i-lucide-trash-2' }
]
const view = computed({
  get: () => (filter.deleted ? 'trash' : 'active'),
  set: (value: string | number) => {
    filter.deleted = value === 'trash'
    // Status doesn't apply in the trash (nothing there is live either way).
    if (filter.deleted) filter.enabled = undefined
    sort.value = { column: filter.deleted ? 'deletedAt' : 'createdAt', direction: 'desc' }
  }
})

const statusFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false }
]
const languageFilterOptions = computed(() => [{ label: 'All languages', value: undefined }, ...languageOptions(filter.language)])
// All categories (disabled ones too — filtering by them is still useful).
const categoryFilterOptions = computed(() => [
  { label: 'All categories', value: undefined },
  ...categoryCatalog().map((c) => ({ label: c.enabled ? c.name : `${c.name} (disabled)`, value: c.id }))
])

// Owner choices come from the user list; fine at this app's scale (see size).
const owners = ref<{ id: number; username: string }[]>([])
const ownerFilterOptions = computed(() => [{ label: 'All owners', value: undefined }, ...owners.value.map((u) => ({ label: u.username, value: u.id }))])
async function loadOwners() {
  try {
    owners.value = (await listUsers({ size: 500, sortBy: 'username', sortOrder: 'asc' })).data
  } catch {
    owners.value = []
  }
}

const columns = computed<ColumnDef<Video>[]>(() => [
  { key: 'title', sortable: true },
  { key: 'ownerUsername', label: 'Owner', value: (row) => row.ownerUsername ?? '—' },
  { key: 'language', sortable: true, value: (row) => languageLabel(row.language) },
  { key: 'durationSeconds', label: 'Duration', sortable: true, class: 'tabular-nums', value: (row) => formatDuration(row.durationSeconds) },
  { key: 'fileSize', label: 'Size', sortable: true, class: 'tabular-nums', value: (row) => (row.fileSize === null ? '—' : formatFileSize(row.fileSize)) },
  { key: 'viewCount', label: 'Views', type: 'number', class: 'tabular-nums' },
  ...(filter.deleted
    ? [{ key: 'deletedAt', label: 'Deleted', type: 'datetime', sortable: true } satisfies ColumnDef<Video>]
    : [
        {
          key: 'enabled',
          label: 'Status',
          type: 'boolean',
          sortable: true,
          trueLabel: 'Enabled',
          falseLabel: 'Disabled',
          falseColor: 'warning'
        } satisfies ColumnDef<Video>,
        { key: 'createdAt', label: 'Uploaded', type: 'date', sortable: true } satisfies ColumnDef<Video>
      ]),
  { key: 'actions', label: '' }
])

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      deleted: filter.deleted,
      enabled: filter.enabled,
      language: filter.language,
      categoryId: filter.categoryId,
      ownerId: filter.ownerId,
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

// Declared before the load watcher so a filter change resets to page 1 and
// the load below runs once, with the page already reset.
watch([() => ({ ...filter }), debouncedSearch, sort, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], load)

const hasActiveFilter = computed(
  () =>
    search.value !== '' ||
    filter.enabled !== undefined ||
    filter.language !== undefined ||
    filter.categoryId !== undefined ||
    filter.ownerId !== undefined ||
    !!filter.createdFrom ||
    !!filter.createdTo
)

function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.enabled = undefined
  filter.language = undefined
  filter.categoryId = undefined
  filter.ownerId = undefined
  filter.createdFrom = undefined
  filter.createdTo = undefined
}

onMounted(() => {
  loadOwners()
  load()
})

// ── Row actions ────────────────────────────────────────────────────────────
function rowActions(row: Video): RowAction[] {
  // One inline button (the likeliest next step) and the rest in the "…" menu —
  // the whole row already opens the video, so View doesn't need a button.
  const view: RowAction = { label: 'View', icon: 'i-lucide-play', onClick: () => navigateTo(`/videos/${row.id}`) }
  if (row.deleted) {
    return [{ label: 'Restore', icon: 'i-lucide-rotate-ccw', color: 'success', loading: busy.value, onClick: () => onRestore(row) }, view]
  }
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) },
    view,
    row.enabled
      ? { label: 'Disable', icon: 'i-lucide-eye-off', color: 'warning', onClick: () => (confirmDisable.value = row) }
      : { label: 'Enable', icon: 'i-lucide-eye', color: 'success', onClick: () => setStatus(row, true) },
    { label: 'Statistics', icon: 'i-lucide-chart-column', onClick: () => navigateTo(`/videos/${row.id}?tab=statistics`) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

const busy = ref(false)
const confirmDisable = ref<Video | null>(null)
const confirmDelete = ref<Video | null>(null)

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

async function setStatus(row: Video, enabled: boolean) {
  if (await run(() => updateStatus(row.id, enabled), enabled ? 'Video enabled' : 'Video disabled', `Could not ${enabled ? 'enable' : 'disable'} video`)) {
    confirmDisable.value = null
  }
}

async function onDelete(row: Video) {
  if (await run(() => remove(row.id), 'Moved to trash', 'Could not delete video')) confirmDelete.value = null
}

function onRestore(row: Video) {
  run(() => restore(row.id), 'Video restored', 'Could not restore video')
}

// ── Edit ───────────────────────────────────────────────────────────────────
const showEdit = ref(false)
const editing = ref<Video | null>(null)
function openEdit(row: Video) {
  editing.value = row
  showEdit.value = true
}
</script>
