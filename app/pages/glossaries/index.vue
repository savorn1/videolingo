<template>
  <div>
    <PageHeader
      title="Glossaries"
      description="Terms that must be translated a fixed way, or not at all. Translations follow every enabled glossary for their language, and the subtitle editor flags cues that break one."
    >
      <template #actions>
        <UButton v-if="canWrite" icon="i-lucide-plus" to="/glossaries/new">New glossary</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search glossaries" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.targetLanguage" :items="targetOptions" placeholder="Target language" class="w-48" />
        <USelect v-model="filter.enabled" :items="enabledOptions" placeholder="Status" class="w-36" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable v-model:sort="sort" :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #name-data="{ row }">
          <div class="min-w-0 max-w-sm">
            <NuxtLink :to="`/glossaries/${row.id}`" class="font-medium text-primary-600 dark:text-primary-400 hover:underline">{{ row.name }}</NuxtLink>
            <p v-if="row.description" class="text-xs text-gray-500 mt-0.5 truncate" :title="row.description">{{ row.description }}</p>
          </div>
        </template>
        <template #languages-data="{ row }">
          <span class="whitespace-nowrap">
            {{ row.sourceLanguage ? languageLabel(row.sourceLanguage) : 'Any language' }}
            <UIcon name="i-lucide-arrow-right" class="w-3 h-3 mx-1 align-middle text-gray-400" />
            {{ languageLabel(row.targetLanguage) }}
          </span>
        </template>
        <template #termCount-data="{ row }">
          <span class="tabular-nums">{{ row.termCount.toLocaleString() }}</span>
        </template>
        <template #enabled-data="{ row }">
          <UBadge :color="row.enabled ? 'success' : 'neutral'" variant="subtle">{{ row.enabled ? 'Enabled' : 'Off' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <div class="min-w-max">
            <RowActions :actions="rowActions(row)" :max="1" />
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No glossaries match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            icon="i-lucide-book-a"
            title="No glossaries yet"
            description="Add brand names, product terms and words that must never be translated — translations will follow them."
          >
            <template v-if="canWrite" #action>
              <UButton icon="i-lucide-plus" to="/glossaries/new">New glossary</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete glossary"
      :description="`Delete “${confirmDelete?.name ?? ''}” and its ${confirmDelete?.termCount ?? 0} term(s)? Translations already made keep their wording.`"
      confirm-label="Delete"
      color="error"
      :loading="saving"
      @update:model-value="(v: boolean) => !v && !saving && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { Glossary } from '~/composables/useGlossaries'

definePageMeta({ middleware: 'admin' })

const { list, update, get, remove } = useGlossaries()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('glossaries', 'WRITE'))

const rows = ref<Glossary[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const filter = reactive<{ targetLanguage: string | undefined; enabled: boolean | undefined }>({ targetLanguage: undefined, enabled: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'name', direction: 'asc' })

useListQuerySync({ filter, search, page })

const targetOptions = computed(() => [{ label: 'Any target language', value: undefined }, ...languageOptions()])
const enabledOptions = [
  { label: 'Any status', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Off', value: false }
]

const columns: ColumnDef<Glossary>[] = [
  { key: 'name', sortable: true },
  { key: 'languages', label: 'Languages' },
  { key: 'termCount', label: 'Terms', sortable: true },
  { key: 'enabled', label: 'Status', sortable: true },
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
      targetLanguage: filter.targetLanguage,
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

const hasActiveFilter = computed(() => search.value !== '' || filter.targetLanguage !== undefined || filter.enabled !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.targetLanguage = undefined
  filter.enabled = undefined
}

onMounted(load)

function rowActions(row: Glossary): RowAction[] {
  return [
    { label: canWrite.value ? 'Edit terms' : 'View terms', icon: 'i-lucide-pencil', color: 'primary', onClick: () => navigateTo(`/glossaries/${row.id}`) },
    ...(canWrite.value
      ? [
          { label: row.enabled ? 'Turn off' : 'Turn on', icon: row.enabled ? 'i-lucide-power-off' : 'i-lucide-power', onClick: () => toggle(row) },
          { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onClick: () => (confirmDelete.value = row) }
        ]
      : [])
  ]
}

// The API replaces the whole glossary, so fetch its terms first.
async function toggle(row: Glossary) {
  try {
    const full = await get(row.id)
    await update(row.id, {
      name: full.name,
      sourceLanguage: full.sourceLanguage,
      targetLanguage: full.targetLanguage,
      description: full.description,
      enabled: !full.enabled,
      terms: (full.terms ?? []).map(({ source, target, doNotTranslate, caseSensitive, note }) => ({ source, target, doNotTranslate, caseSensitive, note }))
    })
    toast.add({ title: full.enabled ? `“${full.name}” turned off` : `“${full.name}” turned on`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not change the glossary', description: apiErrorMessage(err), color: 'error' })
  }
}

const confirmDelete = ref<Glossary | null>(null)
async function onDelete(row: Glossary) {
  saving.value = true
  try {
    await remove(row.id)
    toast.add({ title: `“${row.name}” deleted`, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete glossary', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
