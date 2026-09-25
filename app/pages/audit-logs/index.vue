<template>
  <div>
    <PageHeader
      title="Audit log"
      description="Every change made through the app or the API — who did it, when, and whether it went through. Reads aren't logged; entries are kept for a year."
    />

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search path or detail" icon="i-lucide-search" class="w-56" />
        <UInput v-model="filter.username" placeholder="Username" icon="i-lucide-user" class="w-40" />
        <USelect v-model="filter.module" :items="moduleOptions" placeholder="Area" class="w-44" />
        <USelect v-model="filter.method" :items="methodOptions" placeholder="Method" class="w-32" />
        <USelect v-model="filter.outcome" :items="outcomeOptions" placeholder="Outcome" class="w-36" />
        <UInput v-model="filter.from" type="date" class="w-40" aria-label="From date" />
        <UInput v-model="filter.to" type="date" class="w-40" aria-label="To date" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable v-model:sort="sort" :rows="rows" :columns="columns" :loading="loading" refreshable exportable export-filename="audit-log" @refresh="load">
        <template #createdAt-data="{ row }">
          <span class="whitespace-nowrap text-sm" :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
        </template>
        <template #username-data="{ row }">
          <div class="flex items-center gap-1.5">
            <span v-if="row.username" class="font-medium">{{ row.username }}</span>
            <span v-else class="text-gray-400">—</span>
            <UTooltip v-if="row.authType === 'api-key'" text="Used an API key">
              <UIcon name="i-lucide-key-round" class="w-3.5 h-3.5 text-amber-500" />
            </UTooltip>
          </div>
        </template>
        <template #what-data="{ row }">
          <div class="min-w-0 max-w-md">
            <p class="text-sm text-gray-900 dark:text-white">{{ describeAuditEntry(row) }}</p>
            <p class="text-xs text-gray-500 truncate font-mono" :title="`${row.method} ${row.path}`">{{ row.method }} {{ row.path }}</p>
            <p v-if="row.detail" class="text-xs text-gray-500 truncate">{{ row.detail }}</p>
          </div>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="OUTCOME_COLOR[auditOutcome(row.status)]" variant="subtle" class="tabular-nums">{{ row.status }} · {{ OUTCOME_LABEL[auditOutcome(row.status)] }}</UBadge>
        </template>
        <template #ipAddress-data="{ row }">
          <span class="text-xs font-mono text-gray-500" :title="row.userAgent ?? undefined">{{ row.ipAddress ?? '—' }}</span>
        </template>
        <template #empty-state>
          <EmptyState
            :icon="hasActiveFilter ? 'i-lucide-search-x' : 'i-lucide-scroll-text'"
            :title="hasActiveFilter ? 'No entries match your filters' : 'Nothing logged yet'"
            :description="hasActiveFilter ? 'Try a wider date range or clear your filters.' : 'Changes show up here as soon as someone makes one.'"
          >
            <template v-if="hasActiveFilter" #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { AuditEntry } from '~/composables/useAuditLogs'

definePageMeta({ middleware: 'admin' })

const { list, modules } = useAuditLogs()

const rows = ref<AuditEntry[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{
  username: string
  module: string | undefined
  method: string | undefined
  outcome: 'success' | 'failed' | 'denied' | undefined
  from: string
  to: string
}>({ username: '', module: undefined, method: undefined, outcome: undefined, from: '', to: '' })
const search = ref('')
const page = ref(1)
const pageSize = ref(50)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'createdAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const OUTCOME_COLOR = { success: 'success', failed: 'error', denied: 'warning' } as const
const OUTCOME_LABEL = { success: 'OK', failed: 'Failed', denied: 'Denied' } as const

const knownModules = ref<string[]>([])
const moduleOptions = computed(() => [{ label: 'Every area', value: undefined }, ...knownModules.value.map((m) => ({ label: humanize(m), value: m }))])
const methodOptions = [
  { label: 'Any method', value: undefined },
  ...['POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ label: m, value: m }))
]
const outcomeOptions = [
  { label: 'Any outcome', value: undefined },
  { label: 'Succeeded', value: 'success' as const },
  { label: 'Failed', value: 'failed' as const },
  { label: 'Denied (401/403)', value: 'denied' as const }
]

const columns: ColumnDef<AuditEntry>[] = [
  { key: 'createdAt', label: 'When', sortable: true, value: (r) => r.createdAt },
  { key: 'username', label: 'Who', sortable: true },
  { key: 'what', label: 'What', value: (r) => `${describeAuditEntry(r)} (${r.method} ${r.path})` },
  { key: 'status', label: 'Result', sortable: true, value: (r) => String(r.status) },
  { key: 'durationMs', label: 'Took', type: 'number', sortable: true, suffix: ' ms' },
  { key: 'ipAddress', label: 'IP' }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      username: filter.username.trim() || undefined,
      module: filter.module,
      method: filter.method,
      outcome: filter.outcome,
      from: filter.from || undefined,
      to: filter.to || undefined,
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

// Typed filters (search, username) wait for a pause in typing.
const debounced = ref({ search: search.value, username: filter.username })
let timer: ReturnType<typeof setTimeout> | undefined
watch([search, () => filter.username], ([s, u]) => {
  clearTimeout(timer)
  timer = setTimeout(() => (debounced.value = { search: s, username: u }), 300)
})
const pickers = () => [filter.module, filter.method, filter.outcome, filter.from, filter.to]
watch([pickers, debounced, sort, pageSize], () => {
  page.value = 1
})
watch([pickers, debounced, sort, page, pageSize], load)

const hasActiveFilter = computed(
  () => !!search.value || !!filter.username || !!filter.module || !!filter.method || !!filter.outcome || !!filter.from || !!filter.to
)
function clearFilters() {
  search.value = ''
  Object.assign(filter, { username: '', module: undefined, method: undefined, outcome: undefined, from: '', to: '' })
  debounced.value = { search: '', username: '' }
}

onMounted(async () => {
  load()
  try {
    knownModules.value = await modules()
  } catch {
    knownModules.value = []
  }
})
</script>
