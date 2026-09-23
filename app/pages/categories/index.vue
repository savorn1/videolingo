<template>
  <div>
    <PageHeader
      title="Categories"
      description="Topics videos are filed under. Disabled categories stay on their videos but aren't offered for new ones or shown to learners."
    >
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openForm(null)">New category</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search name, slug or description" icon="i-lucide-search" class="w-72" />
        <USelect v-model="filter.enabled" :items="statusFilterOptions" placeholder="Status" class="w-36" />
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
        export-filename="categories"
        @refresh="load"
        @select="(row: Category) => navigateTo(`/categories/${row.id}`)"
      >
        <template #name-data="{ row }">
          <div class="min-w-0 max-w-sm">
            <CategoryBadge :name="row.name" :color="row.color" :enabled="row.enabled" />
            <p v-if="row.description" class="text-xs text-gray-500 mt-1 truncate" :title="row.description">{{ row.description }}</p>
          </div>
        </template>

        <template #slug-data="{ row }">
          <code class="text-xs font-mono text-gray-500">{{ row.slug }}</code>
        </template>

        <template #videoCount-data="{ row }">
          <NuxtLink
            v-if="row.videoCount"
            :to="`/videos?categoryId=${row.id}`"
            class="tabular-nums text-primary-600 dark:text-primary-400 hover:underline"
            @click.stop
          >
            {{ row.videoCount }} video{{ row.videoCount === 1 ? '' : 's' }}
          </NuxtLink>
          <span v-else class="text-gray-400">None</span>
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
            title="No categories match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            icon="i-lucide-folder-tree"
            title="No categories yet"
            description="Create topics like “Food & Drink” or “Travel” to organise videos."
          >
            <template #action>
              <UButton icon="i-lucide-plus" @click="openForm(null)">New category</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <CategoryFormModal v-model="showForm" :category="editing" @saved="load" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete category"
      :description="deleteDescription"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { Category } from '~/composables/useCategories'

definePageMeta({ middleware: 'admin' })

const { list, setEnabled, remove } = useCategories()
const toast = useToast()

const rows = ref<Category[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ enabled: boolean | undefined }>({ enabled: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(50)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'sortOrder', direction: 'asc' })

useListQuerySync({ filter, search, page })

const statusFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false }
]

const columns: ColumnDef<Category>[] = [
  { key: 'name', sortable: true },
  { key: 'slug', sortable: true },
  { key: 'videoCount', label: 'Videos', value: (row) => String(row.videoCount) },
  { key: 'sortOrder', label: 'Order', type: 'number', sortable: true, class: 'tabular-nums' },
  { key: 'enabled', label: 'Status', type: 'boolean', sortable: true, trueLabel: 'Enabled', falseLabel: 'Disabled', falseColor: 'warning' },
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
      enabled: filter.enabled,
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

const hasActiveFilter = computed(() => search.value !== '' || filter.enabled !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.enabled = undefined
}

onMounted(load)

// ── Actions ────────────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Category | null>(null)
function openForm(row: Category | null) {
  editing.value = row
  showForm.value = true
}

const busy = ref(false)
const confirmDelete = ref<Category | null>(null)
const deleteDescription = computed(() => {
  const c = confirmDelete.value
  if (!c) return ''
  return c.videoCount
    ? `Delete “${c.name}”? It will be removed from the ${c.videoCount} video(s) filed under it — the videos themselves are kept. If you only want to stop using it, disable it instead.`
    : `Delete “${c.name}”? No videos use it. This cannot be undone.`
})

function rowActions(row: Category): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openForm(row) },
    { label: 'View', icon: 'i-lucide-eye', onClick: () => navigateTo(`/categories/${row.id}`) },
    row.enabled
      ? { label: 'Disable', icon: 'i-lucide-eye-off', color: 'warning', onClick: () => toggle(row, false) }
      : { label: 'Enable', icon: 'i-lucide-eye', color: 'success', onClick: () => toggle(row, true) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

// Enable/disable is immediately reversible, so no confirm step.
async function toggle(row: Category, enabled: boolean) {
  try {
    await setEnabled(row.id, enabled)
    toast.add({
      title: `${row.name} ${enabled ? 'enabled' : 'disabled'}`,
      description: !enabled && row.videoCount ? `It stays on its ${row.videoCount} video(s), but isn't offered for new ones.` : undefined,
      color: 'success'
    })
    await load()
  } catch (err) {
    toast.add({ title: `Could not ${enabled ? 'enable' : 'disable'} category`, description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDelete(row: Category) {
  busy.value = true
  try {
    const detached = await remove(row.id)
    toast.add({ title: `${row.name} deleted`, description: detached ? `Removed from ${detached} video(s).` : undefined, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete category', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>
