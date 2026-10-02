<template>
  <div>
    <PageHeader title="Videos" description="Learning videos — uploaded, linked from YouTube, Vimeo or Facebook, or hosted elsewhere.">
      <template #actions>
        <UButton v-if="filter.deleted" color="error" variant="soft" icon="i-lucide-trash-2" :loading="clearingTrash" @click="onClearTrashClick">
          Clear trash
        </UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-audio-lines" to="/videos/from-audio">From audio</UButton>
        <UButton icon="i-lucide-plus" to="/videos/new">Add video</UButton>
      </template>
    </PageHeader>

    <UTabs v-model="view" :items="viewItems" :content="false" class="mb-4 w-full sm:w-80" />

    <SummaryTiles v-if="summaryTiles.length" :tiles="summaryTiles" @select="onSelectTile" />

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search title or description" icon="i-lucide-search" class="w-full sm:w-64" />
        <USelect v-if="!filter.deleted" v-model="filter.enabled" :items="statusFilterOptions" placeholder="Status" class="w-36" />
        <USelect v-model="filter.categoryId" :items="categoryFilterOptions" placeholder="Category" class="w-44" />
        <UButton
          color="neutral"
          :variant="showMoreFilters ? 'soft' : 'ghost'"
          icon="i-lucide-sliders-horizontal"
          :trailing-icon="showMoreFilters ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          :aria-expanded="showMoreFilters"
          @click="showMoreFilters = !showMoreFilters"
        >
          More filters
          <UBadge v-if="moreFilterCount" size="sm" variant="solid">{{ moreFilterCount }}</UBadge>
        </UButton>
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
      <div v-if="showMoreFilters" class="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <USelect v-model="filter.language" :items="languageFilterOptions" placeholder="Language" class="w-40" />
        <USelectMenu
          v-model="filter.tagId"
          :items="tagFilterOptions"
          value-key="value"
          placeholder="Tag"
          :search-input="{ placeholder: 'Search tags…' }"
          class="w-40"
          aria-label="Tag"
        />
        <USelectMenu
          v-model="filter.ownerId"
          aria-label="Owner"
          :items="ownerFilterOptions"
          value-key="value"
          placeholder="Owner"
          :search-input="{ placeholder: 'Search users…' }"
          class="w-44"
        />
        <div class="flex items-center gap-2">
          <UInput v-model="filter.createdFrom" type="date" aria-label="Uploaded from" class="w-40" :max="filter.createdTo" />
          <span class="text-sm text-gray-500 dark:text-gray-400">–</span>
          <UInput v-model="filter.createdTo" type="date" aria-label="Uploaded to" class="w-40" :min="filter.createdFrom" />
        </div>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable
        v-model:sort="sort"
        v-model:selected="selected"
        :rows="rows"
        :columns="columns"
        :loading="loading"
        selectable
        :total-count="total"
        @select-all-matching="selectAllMatching"
        refreshable
        exportable
        :export-filename="filter.deleted ? 'videos-trash' : 'videos'"
        @refresh="load"
        @select="(row: Video) => navigateTo(`/videos/${row.id}`)"
      >
        <template #bulk-actions="{ selected: picked, clear }">
          <UButton
            v-if="!filter.deleted && picked.length >= 2"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-combine"
            title="Make one new video from the selected videos"
            @click="openMerge(picked)"
          >
            Join into one video
          </UButton>
          <VideoBulkActions
            :videos="picked"
            :trash="filter.deleted"
            @done="
              () => {
                clear()
                load()
                loadTileCounts()
              }
            "
          />
        </template>
        <template #title-data="{ row }">
          <div class="flex items-center gap-3 min-w-0 max-w-xs">
            <div class="relative w-24 aspect-video shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
              <HoverScrubThumbnail :thumbnail-url="row.thumbnailUrl" :video-url="row.videoUrl" :duration-seconds="row.durationSeconds" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 dark:text-white truncate" :title="row.title">{{ row.title }}</p>
              <UBadge
                v-if="making.get(row.id)"
                color="info"
                variant="subtle"
                size="sm"
                icon="i-lucide-loader"
                class="mt-0.5 [&_svg]:animate-spin motion-reduce:[&_svg]:animate-none"
                :title="'Its file is still being made; it stays hidden until you enable it'"
              >
                {{ making.get(row.id)!.label }}
              </UBadge>
              <p v-if="row.description" class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ row.description }}</p>
              <div v-if="row.categories.length || row.tags.length" class="flex flex-wrap gap-1 mt-1">
                <CategoryBadge v-for="c in row.categories" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
                <TagChip v-for="t in row.tags.slice(0, 4)" :key="t.id" :name="t.name" />
                <span v-if="row.tags.length > 4" class="text-xs text-gray-500 dark:text-gray-400">+{{ row.tags.length - 4 }}</span>
              </div>
            </div>
          </div>
        </template>

        <template #language-data="{ row }">
          <span
            v-if="row.language"
            class="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
          >
            <UIcon name="i-lucide-globe" class="size-3" />
            {{ languageLabel(row.language) }}
          </span>
          <span v-else class="text-gray-500 dark:text-gray-400">—</span>
        </template>

        <template #durationSeconds-data="{ row }">
          <span class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
            <UIcon name="i-lucide-clock" class="size-3.5 text-violet-600 dark:text-violet-400" />
            {{ formatDuration(row.durationSeconds) }}
          </span>
        </template>

        <template #viewCount-data="{ row }">
          <span
            class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
            :class="row.viewCount ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'"
          >
            <UIcon name="i-lucide-eye" class="size-3.5" />
            {{ (row.viewCount ?? 0).toLocaleString() }}
          </span>
        </template>

        <template #ownerUsername-data="{ row }">
          <NuxtLink v-if="row.ownerUsername" :to="`/users/${row.ownerId}`" class="text-violet-700 dark:text-violet-300 hover:underline" @click.stop>
            {{ row.ownerUsername }}
          </NuxtLink>
          <span v-else class="text-gray-500 dark:text-gray-400">{{ row.ownerId ? 'Deleted user' : '—' }}</span>
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
          <EmptyState
            v-else-if="filter.archived"
            icon="i-lucide-archive"
            title="No archived videos"
            description="Videos you archive show up here, put aside but not in the trash."
          />
          <EmptyState
            v-else
            icon="i-lucide-clapperboard"
            title="No videos yet"
            description="Upload a file or paste a YouTube, Vimeo or Facebook link to add your first video."
          >
            <template #action>
              <UButton icon="i-lucide-plus" to="/videos/new">Add video</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > 0" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <VideoEditModal v-model="showEdit" :video="editing" @saved="load" />
    <VideoPeekModal
      :video="peeking"
      can-write
      @close="peeking = null"
      @edit="
        (v: Video) => {
          peeking = null
          openEdit(v)
        }
      "
    />

    <MergeVideosModal v-model="showMerge" :items="mergeItems" />

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
      :model-value="confirmPurge !== null"
      title="Delete permanently"
      :description="`Permanently delete '${confirmPurge?.title ?? ''}' and free its storage? This cannot be undone — restoring won't be possible afterwards.`"
      confirm-label="Delete permanently"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && (confirmPurge = null)"
      @confirm="confirmPurge && onPurge(confirmPurge)"
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
    <ConfirmModal
      :model-value="confirmClearTrash"
      title="Clear trash"
      :description="`Permanently delete ${trashCount ?? 0} video(s) and free their storage? This cannot be undone — restoring won't be possible afterwards.`"
      confirm-label="Clear trash"
      color="error"
      :loading="clearingTrash"
      @update:model-value="(v: boolean) => !v && !clearingTrash && (confirmClearTrash = false)"
      @confirm="onClearTrashConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { Video } from '~/composables/useVideos'
import type { MergeItem } from '#shared/utils/mergeVideos'
import type { SummaryTile } from '~/components/SummaryTiles.vue'

definePageMeta({ middleware: 'admin' })

const { list, updateStatus, remove, restore, archive, unarchive, duplicate, purge, purgeTrash } = useVideos()
// Rows ticked for bulk actions (VideoBulkActions).
const selected = ref<Video[]>([])

// Videos still being made get a live badge; when one finishes the list is refreshed so it shows its real thumbnail and length.
const { making } = useMakingVideos({
  onFinished: () => {
    load()
    loadTileCounts()
  }
})

// Joining the selected videos into one; the dialog is where the order is set.
const showMerge = ref(false)
const mergeItems = ref<MergeItem[]>([])
function openMerge(picked: Video[]) {
  mergeItems.value = picked.map((v) => ({
    id: v.id,
    title: v.title,
    durationSeconds: v.durationSeconds,
    thumbnailUrl: v.thumbnailUrl,
    blocked: blockedReason(v)
  }))
  showMerge.value = true
}
const { list: listUsers } = useUsers()
const { list: listTags } = useTags()
const toast = useToast()

const rows = ref<Video[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

// ── Filters (server-side) ──────────────────────────────────────────────────
const filter = reactive<{
  deleted: boolean
  archived: boolean
  enabled: boolean | undefined
  language: string | undefined
  categoryId: number | undefined
  tagId: number | undefined
  ownerId: number | undefined
  createdFrom: string | undefined
  createdTo: string | undefined
}>({
  deleted: false,
  archived: false,
  enabled: undefined,
  language: undefined,
  categoryId: undefined,
  tagId: undefined,
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
  { label: 'Archived', value: 'archived', icon: 'i-lucide-archive' },
  { label: 'Trash', value: 'trash', icon: 'i-lucide-trash-2' }
]
const view = computed({
  get: () => (filter.deleted ? 'trash' : filter.archived ? 'archived' : 'active'),
  set: (value: string | number) => {
    filter.deleted = value === 'trash'
    filter.archived = value === 'archived'
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
// Tag filter options: the 200 most relevant tags by name — enough for a picker;
// a deep link (?tagId=) to any other tag still filters correctly.
const tags = ref<{ id: number; name: string }[]>([])
const tagFilterOptions = computed(() => [{ label: 'All tags', value: undefined }, ...tags.value.map((t) => ({ label: `#${t.name}`, value: t.id }))])
async function loadTags() {
  try {
    tags.value = (await listTags({ size: 200, sortBy: 'name', sortOrder: 'asc' })).data
  } catch {
    tags.value = []
  }
}

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

/** The list's current filters, for both a page load and "select all". */
function listFilter() {
  return {
    search: search.value.trim() || undefined,
    deleted: filter.deleted,
    archived: filter.archived,
    enabled: filter.enabled,
    language: filter.language,
    categoryId: filter.categoryId,
    tagId: filter.tagId,
    ownerId: filter.ownerId,
    createdFrom: filter.createdFrom || undefined,
    createdTo: filter.createdTo || undefined,
    sortBy: sort.value?.column,
    sortOrder: sort.value?.direction
  }
}

// "Select all N": every video matching the filters, up to a limit that keeps
// bulk actions (one request per video) reasonable.
const SELECT_ALL_LIMIT = 500
async function selectAllMatching(done: () => void) {
  try {
    const res = await list({ ...listFilter(), page: 1, size: SELECT_ALL_LIMIT })
    selected.value = res.data
    if (res.metadata.totalCount > SELECT_ALL_LIMIT) {
      toast.add({ title: `Selected the first ${SELECT_ALL_LIMIT}`, description: 'Narrow the filters to work on the rest.', color: 'warning' })
    }
  } catch (err) {
    toast.add({ title: 'Could not select all', description: apiErrorMessage(err), color: 'error' })
  } finally {
    done()
  }
}

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({ ...listFilter(), page: page.value, size: pageSize.value })
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
  // A different list — what was selected may not even be in it. (Paging keeps the selection.)
  selected.value = []
})
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], load)

// Less-used filters sit behind "More filters"; it opens by itself when a
// link (or a return from a video) arrives with one of them set.
const moreFilterCount = computed(
  () => [filter.language, filter.tagId, filter.ownerId].filter((v) => v !== undefined).length + (filter.createdFrom || filter.createdTo ? 1 : 0)
)
const showMoreFilters = ref(moreFilterCount.value > 0)

const hasActiveFilter = computed(
  () =>
    search.value !== '' ||
    filter.enabled !== undefined ||
    filter.language !== undefined ||
    filter.categoryId !== undefined ||
    filter.tagId !== undefined ||
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
  filter.tagId = undefined
  filter.ownerId = undefined
  filter.createdFrom = undefined
  filter.createdTo = undefined
}

// ── Summary tiles ────────────────────────────────────────────────────────────
// Only the active-videos view has a status split worth showing (archived/trash
// don't have an "enabled" concept the way live videos do); global counts, not
// scoped to the other filters — a quick "how's the library doing" glance,
// same spirit as Processing Jobs' status tiles.
const tileCounts = ref<{ total: number | null; enabled: number | null; disabled: number | null }>({ total: null, enabled: null, disabled: null })
async function loadTileCounts() {
  tileCounts.value = { total: null, enabled: null, disabled: null }
  const count = async (enabled?: boolean) => {
    try {
      return (await list({ deleted: false, archived: false, enabled, page: 1, size: 1 })).metadata.totalCount
    } catch {
      return null
    }
  }
  const [total, enabled, disabled] = await Promise.all([count(), count(true), count(false)])
  tileCounts.value = { total, enabled, disabled }
}
const summaryTiles = computed<SummaryTile[]>(() =>
  view.value !== 'active'
    ? []
    : [
        {
          key: 'all',
          label: 'Live videos',
          count: tileCounts.value.total,
          icon: 'i-lucide-clapperboard',
          active: filter.enabled === undefined,
          color: 'primary'
        },
        { key: 'enabled', label: 'Enabled', count: tileCounts.value.enabled, icon: 'i-lucide-eye', active: filter.enabled === true, color: 'success' },
        { key: 'disabled', label: 'Disabled', count: tileCounts.value.disabled, icon: 'i-lucide-eye-off', active: filter.enabled === false, color: 'neutral' }
      ]
)
function onSelectTile(key: string) {
  const next = key === 'enabled' ? true : key === 'disabled' ? false : undefined
  // Clicking the tile that's already the active filter clears it back to "all".
  filter.enabled = filter.enabled === next ? undefined : next
}

onMounted(() => {
  loadOwners()
  loadTags()
  load()
  loadTileCounts()
})
watch(view, loadTileCounts)

// ── Row actions ────────────────────────────────────────────────────────────
function rowActions(row: Video): RowAction[] {
  // One inline button (the likeliest next step) and the rest in the "…" menu —
  // the whole row already opens the video, so View doesn't need a button.
  const view: RowAction = { label: 'View', icon: 'i-lucide-play', onClick: () => navigateTo(`/videos/${row.id}`) }
  const peek: RowAction = { label: 'Quick view', icon: 'i-lucide-eye', onClick: () => (peeking.value = row) }
  if (row.deleted) {
    return [
      { label: 'Restore', icon: 'i-lucide-rotate-ccw', color: 'success', loading: busy.value, onClick: () => onRestore(row) },
      peek,
      view,
      { label: 'Delete permanently', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmPurge.value = row) }
    ]
  }
  return [
    peek,
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) },
    view,
    row.enabled
      ? { label: 'Disable', icon: 'i-lucide-eye-off', color: 'warning', onClick: () => (confirmDisable.value = row) }
      : { label: 'Enable', icon: 'i-lucide-eye', color: 'success', onClick: () => setStatus(row, true) },
    { label: 'Duplicate', icon: 'i-lucide-copy', loading: duplicating.value === row.id, onClick: () => onDuplicate(row) },
    row.archived
      ? { label: 'Unarchive', icon: 'i-lucide-archive-restore', onClick: () => onArchiveToggle(row, false) }
      : { label: 'Archive', icon: 'i-lucide-archive', onClick: () => onArchiveToggle(row, true) },
    { label: 'Statistics', icon: 'i-lucide-chart-column', onClick: () => navigateTo(`/videos/${row.id}?tab=statistics`) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

const busy = ref(false)
const confirmDisable = ref<Video | null>(null)
const confirmDelete = ref<Video | null>(null)
const confirmPurge = ref<Video | null>(null)
const peeking = ref<Video | null>(null)

async function run(action: () => Promise<unknown>, success: string, failure: string) {
  busy.value = true
  try {
    await action()
    toast.add({ title: success, color: 'success' })
    await load()
    loadTileCounts()
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

async function onPurge(row: Video) {
  if (await run(() => purge(row.id), 'Video permanently deleted', 'Could not permanently delete video')) confirmPurge.value = null
}

// ── Clear trash ────────────────────────────────────────────────────────────
// The count shown in the confirm dialog is fetched fresh (ignoring search/
// category filters) since the purge always empties the whole trash, not just
// what's currently visible in the filtered list.
const confirmClearTrash = ref(false)
const clearingTrash = ref(false)
const trashCount = ref<number | null>(null)
async function onClearTrashClick() {
  trashCount.value = null
  confirmClearTrash.value = true
  try {
    trashCount.value = (await list({ deleted: true, page: 1, size: 1 })).metadata.totalCount
  } catch {
    trashCount.value = total.value
  }
}
async function onClearTrashConfirm() {
  clearingTrash.value = true
  try {
    await purgeTrash()
    toast.add({ title: 'Trash cleared', color: 'success' })
    confirmClearTrash.value = false
    selected.value = []
    await load()
  } catch (err) {
    toast.add({ title: 'Could not clear the trash', description: apiErrorMessage(err), color: 'error' })
  } finally {
    clearingTrash.value = false
  }
}

function onArchiveToggle(row: Video, archived: boolean) {
  run(
    () => (archived ? archive(row.id) : unarchive(row.id)),
    archived ? 'Video archived' : 'Video unarchived',
    `Could not ${archived ? 'archive' : 'unarchive'} video`
  )
}

const duplicating = ref<number | null>(null)
async function onDuplicate(row: Video) {
  duplicating.value = row.id
  try {
    const copy = await duplicate(row.id)
    toast.add({ title: `Duplicated as “${copy.title}”`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not duplicate video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    duplicating.value = null
  }
}

// ── Edit ───────────────────────────────────────────────────────────────────
const showEdit = ref(false)
const editing = ref<Video | null>(null)
function openEdit(row: Video) {
  editing.value = row
  showEdit.value = true
}
</script>
