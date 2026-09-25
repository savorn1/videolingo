<template>
  <div>
    <PageHeader title="Collections" description="Ordered sets of videos — playlists, course units, staff picks.">
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openForm(null)">New collection</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search title or description" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.visibility" :items="visibilityFilterOptions" placeholder="Visibility" class="w-40" />
        <USelectMenu
          v-model="filter.ownerId"
          :items="ownerFilterOptions"
          value-key="value"
          placeholder="Owner"
          :search-input="{ placeholder: 'Search users…' }"
          aria-label="Owner"
          class="w-44"
        />
        <USelect v-model="sortKey" :items="sortOptions" class="w-48" aria-label="Sort" />
        <UBadge v-if="filter.videoId" color="neutral" variant="subtle" size="lg" class="gap-1">
          Containing video #{{ filter.videoId }}
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

    <div v-if="loading && !rows.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <USkeleton v-for="i in 4" :key="i" class="h-64 rounded-lg" />
    </div>
    <div v-else-if="rows.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <UCard v-for="c in rows" :key="c.id" :ui="{ body: 'p-0 sm:p-0' }" class="overflow-hidden flex flex-col group">
        <div class="relative">
          <NuxtLink :to="`/collections/${c.id}`" class="block">
            <CollectionCover :src="c.coverUrl">
              <span class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
              <span class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
                {{ c.videoCount }} video{{ c.videoCount === 1 ? '' : 's' }}
              </span>
            </CollectionCover>
          </NuxtLink>
          <!-- A sibling of the card link, not inside it: links can't nest. -->
          <div v-if="c.videoCount" class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <NuxtLink
              :to="`/collections/${c.id}/play`"
              :aria-label="`Play ${c.title}`"
              class="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full bg-primary-600 text-white shadow-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            >
              <UIcon name="i-lucide-play" class="w-6 h-6 ml-0.5" />
            </NuxtLink>
          </div>
        </div>
        <div class="p-4 flex-1 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <NuxtLink :to="`/collections/${c.id}`" class="font-semibold text-gray-900 dark:text-white hover:underline line-clamp-2">{{ c.title }}</NuxtLink>
            <UDropdownMenu :items="menu(c)" :content="{ align: 'end' }">
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="`Actions for ${c.title}`" />
            </UDropdownMenu>
          </div>
          <p v-if="c.description" class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{{ c.description }}</p>
          <div class="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-gray-500">
            <UBadge :color="visibilityMeta(c.visibility).color" variant="subtle" :icon="visibilityMeta(c.visibility).icon" size="sm">
              {{ visibilityMeta(c.visibility).label }}
            </UBadge>
            <span class="truncate" :title="formatDateTime(c.updatedAt)">{{ c.ownerUsername ?? '—' }} · {{ formatRelativeTime(c.updatedAt) }}</span>
          </div>
        </div>
      </UCard>
    </div>
    <UCard v-else>
      <EmptyState
        v-if="hasActiveFilter"
        icon="i-lucide-search-x"
        title="No collections match your filters"
        description="Try a different search or clear your filters."
      >
        <template #action>
          <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
        </template>
      </EmptyState>
      <EmptyState v-else icon="i-lucide-library" title="No collections yet" description="Group videos into playlists or course units.">
        <template #action>
          <UButton icon="i-lucide-plus" @click="openForm(null)">New collection</UButton>
        </template>
      </EmptyState>
    </UCard>

    <div v-if="total > pageSize" class="pt-4">
      <DataPagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-size-options="[12, 24, 48].map((n) => ({ label: String(n), value: n }))"
      />
    </div>

    <CollectionFormModal v-model="showForm" :collection="editing" @saved="(c) => (editing ? load() : navigateTo(`/collections/${c.id}`))" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete collection"
      :description="`Delete “${confirmDelete?.title ?? ''}”? Its ${confirmDelete?.videoCount ?? 0} video(s) are not deleted — only the collection.`"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { COLLECTION_VISIBILITIES, type Collection, type CollectionVisibility } from '~/composables/useCollections'

definePageMeta({ middleware: 'admin' })

const { list, remove } = useCollections()
const { list: listUsers } = useUsers()
const toast = useToast()

const rows = ref<Collection[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ visibility: CollectionVisibility | undefined; ownerId: number | undefined; videoId: number | undefined }>({
  visibility: undefined,
  ownerId: undefined,
  videoId: undefined
})
const search = ref('')
const page = ref(1)
const pageSize = ref(12)

useListQuerySync({ filter, search, page })

const sortOptions = [
  { label: 'Recently updated', value: 'updatedAt:desc' },
  { label: 'Newest', value: 'createdAt:desc' },
  { label: 'Title A–Z', value: 'title:asc' },
  { label: 'Most videos', value: 'videoCount:desc' }
]
const sortKey = ref('updatedAt:desc')

const visibilityFilterOptions = [{ label: 'Any visibility', value: undefined }, ...COLLECTION_VISIBILITIES.map((v) => ({ label: v.label, value: v.value }))]
function visibilityMeta(v: CollectionVisibility) {
  return COLLECTION_VISIBILITIES.find((x) => x.value === v) ?? COLLECTION_VISIBILITIES[2]!
}

const users = ref<{ id: number; username: string }[]>([])
const ownerFilterOptions = computed(() => [{ label: 'All owners', value: undefined }, ...users.value.map((u) => ({ label: u.username, value: u.id }))])

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  const [sortBy, sortOrder] = sortKey.value.split(':') as [string, 'asc' | 'desc']
  try {
    const res = await list({ search: search.value.trim() || undefined, ...filter, sortBy, sortOrder, page: page.value, size: pageSize.value })
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
watch([() => ({ ...filter }), debouncedSearch, sortKey, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, sortKey, page, pageSize], load)

const hasActiveFilter = computed(() => search.value !== '' || !!filter.visibility || filter.ownerId !== undefined || filter.videoId !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  Object.assign(filter, { visibility: undefined, ownerId: undefined, videoId: undefined })
}

onMounted(async () => {
  load()
  try {
    users.value = (await listUsers({ size: 500, sortBy: 'username', sortOrder: 'asc' })).data
  } catch {
    users.value = []
  }
})

// ── Actions ────────────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Collection | null>(null)
function openForm(c: Collection | null) {
  editing.value = c
  showForm.value = true
}

function menu(c: Collection): DropdownMenuItem[][] {
  return [
    [
      ...(c.videoCount
        ? [
            { label: 'Play', icon: 'i-lucide-play', onSelect: () => navigateTo(`/collections/${c.id}/play`) },
            { label: 'Shuffle play', icon: 'i-lucide-shuffle', onSelect: () => navigateTo(`/collections/${c.id}/play?shuffle=1`) }
          ]
        : []),
      { label: 'Open', icon: 'i-lucide-list-video', onSelect: () => navigateTo(`/collections/${c.id}`) },
      { label: 'Edit details', icon: 'i-lucide-pencil', onSelect: () => openForm(c) }
    ],
    [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => (confirmDelete.value = c) }]
  ]
}

const busy = ref(false)
const confirmDelete = ref<Collection | null>(null)
async function onDelete(c: Collection) {
  busy.value = true
  try {
    await remove(c.id)
    toast.add({ title: `“${c.title}” deleted`, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete collection', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>
