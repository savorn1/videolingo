<template>
  <div>
    <PageHeader title="Notification templates" description="Reusable messages with {{placeholders}} — pick one when sending.">
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openForm(null)">New template</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search name, code or subject" icon="i-lucide-search" class="w-72" />
        <USelect v-model="filter.channel" :items="channelFilterOptions" placeholder="Channel" class="w-40" aria-label="Channel" />
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
        export-filename="notification-templates"
        @refresh="load"
      >
        <template #name-data="{ row }">
          <div class="min-w-0 max-w-sm">
            <button type="button" class="font-medium text-gray-900 dark:text-white hover:underline text-left" @click="openForm(row)">{{ row.name }}</button>
            <p class="text-xs font-mono text-gray-500">{{ row.code }}</p>
          </div>
        </template>
        <template #subject-data="{ row }">
          <div class="min-w-0 max-w-md">
            <p class="truncate" :title="row.subject">{{ row.subject }}</p>
            <p v-if="row.description" class="text-xs text-gray-500 truncate" :title="row.description">{{ row.description }}</p>
          </div>
        </template>
        <template #defaultChannels-data="{ row }">
          <div class="flex gap-1">
            <UBadge v-for="c in row.defaultChannels" :key="c" color="neutral" variant="subtle" size="sm" :icon="channelMeta(c).icon">{{
              channelMeta(c).label
            }}</UBadge>
          </div>
        </template>
        <template #variables-data="{ row }">
          <span v-if="!row.variables.length" class="text-gray-400">—</span>
          <div v-else class="flex flex-wrap gap-1">
            <UBadge v-for="v in row.variables" :key="v" color="primary" variant="subtle" size="sm" class="font-mono">{{ v }}</UBadge>
          </div>
        </template>
        <template #usageCount-data="{ row }">
          <NuxtLink
            v-if="row.usageCount"
            :to="`/notifications/history?templateId=${row.id}`"
            class="tabular-nums text-primary-600 dark:text-primary-400 hover:underline"
          >
            {{ row.usageCount }} send{{ row.usageCount === 1 ? '' : 's' }}
          </NuxtLink>
          <span v-else class="text-gray-400">Never used</span>
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
            title="No templates match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            icon="i-lucide-file-text"
            title="No templates yet"
            description="Save messages you send often, with placeholders for the parts that change."
          >
            <template #action>
              <UButton icon="i-lucide-plus" @click="openForm(null)">New template</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <NotificationTemplateFormModal v-model="showForm" :template="editing" @saved="load" />

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete template"
      :description="
        confirmDelete?.usageCount
          ? `Delete “${confirmDelete.name}”? It was used for ${confirmDelete.usageCount} send(s) — those stay in the history.`
          : `Delete “${confirmDelete?.name ?? ''}”? It has never been used.`
      "
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => !v && !deleting && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { NotificationChannel } from '#shared/utils/notifications'
import type { NotificationTemplate } from '~/composables/useNotifications'

definePageMeta({ middleware: 'admin' })

const { templates, removeTemplate } = useNotifications()
const toast = useToast()

const rows = ref<NotificationTemplate[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ channel: NotificationChannel | undefined }>({ channel: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'name', direction: 'asc' })

useListQuerySync({ filter, search, page })

const channelFilterOptions = [{ label: 'Any channel', value: undefined }, ...NOTIFICATION_CHANNELS.map((c) => ({ label: c.label, value: c.value }))]

const columns: ColumnDef<NotificationTemplate>[] = [
  { key: 'name', sortable: true },
  { key: 'subject', sortable: true },
  { key: 'defaultChannels', label: 'Channels', value: (r) => r.defaultChannels.map((c) => channelMeta(c).label).join(', ') },
  { key: 'variables', label: 'Asks for', value: (r) => r.variables.join(', ') },
  { key: 'usageCount', label: 'Used', value: (r) => String(r.usageCount) },
  { key: 'updatedAt', label: 'Updated', type: 'datetime', sortable: true },
  { key: 'actions', label: '' }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await templates({
      search: search.value.trim() || undefined,
      channel: filter.channel,
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

const hasActiveFilter = computed(() => search.value !== '' || filter.channel !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.channel = undefined
}

onMounted(load)

function rowActions(row: NotificationTemplate): RowAction[] {
  return [
    { label: 'Send', icon: 'i-lucide-send', color: 'primary', onClick: () => navigateTo(`/notifications/send?templateId=${row.id}`) },
    { label: 'Edit', icon: 'i-lucide-pencil', onClick: () => openForm(row) },
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

const showForm = ref(false)
const editing = ref<NotificationTemplate | null>(null)
function openForm(row: NotificationTemplate | null) {
  editing.value = row
  showForm.value = true
}

const confirmDelete = ref<NotificationTemplate | null>(null)
const deleting = ref(false)
async function onDelete(row: NotificationTemplate) {
  deleting.value = true
  try {
    await removeTemplate(row.id)
    toast.add({ title: `${row.name} deleted`, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete template', description: apiErrorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>
