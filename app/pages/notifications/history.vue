<template>
  <div>
    <PageHeader
      title="Notification history"
      description="Every send — who it went to and how delivery went."
      :crumbs="[{ label: 'Notifications', to: '/notifications' }, { label: 'History' }]"
    >
      <template #actions>
        <UButton icon="i-lucide-send" to="/notifications/send">Send notification</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search subject, template or sender" icon="i-lucide-search" class="w-72" />
        <USelectMenu
          v-model="filter.templateId"
          :items="templateOptions"
          value-key="value"
          placeholder="Template"
          :search-input="{ placeholder: 'Search templates…' }"
          aria-label="Template"
          class="w-52"
        />
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
        export-filename="notification-history"
        @refresh="load"
        @select="(row: NotificationBatch) => navigateTo(`/notifications?batchId=${row.id}`)"
      >
        <template #subject-data="{ row }">
          <div class="min-w-0 max-w-md">
            <NuxtLink :to="`/notifications?batchId=${row.id}`" class="font-medium text-gray-900 dark:text-white hover:underline line-clamp-1" @click.stop>
              {{ row.subject }}
            </NuxtLink>
            <p class="text-xs text-gray-500">{{ row.templateName ? `Template: ${row.templateName}` : 'Written directly' }}</p>
          </div>
        </template>
        <template #audience-data="{ row }">
          <p>{{ row.audience }}</p>
          <p class="text-xs text-gray-500">{{ row.recipientCount }} recipient{{ row.recipientCount === 1 ? '' : 's' }}</p>
        </template>
        <template #channels-data="{ row }">
          <div class="flex gap-1">
            <UBadge v-for="c in row.channels" :key="c" color="neutral" variant="subtle" size="sm" :icon="channelMeta(c).icon">{{
              channelMeta(c).label
            }}</UBadge>
          </div>
        </template>
        <template #delivery-data="{ row }">
          <NotificationBatchStats :batch="row" />
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No sends match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-history" title="Nothing sent yet" description="Each notification you send appears here with its delivery results.">
            <template #action>
              <UButton icon="i-lucide-send" to="/notifications/send">Send notification</UButton>
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
import type { NotificationBatch, NotificationTemplate } from '~/composables/useNotifications'

definePageMeta({ middleware: 'admin' })

const notifications = useNotifications()

const rows = ref<NotificationBatch[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const templatesList = ref<NotificationTemplate[]>([])

const filter = reactive<{ templateId: number | undefined }>({ templateId: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'createdAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const templateOptions = computed(() => [{ label: 'Any template', value: undefined }, ...templatesList.value.map((t) => ({ label: t.name, value: t.id }))])

const columns: ColumnDef<NotificationBatch>[] = [
  { key: 'createdAt', label: 'Sent', type: 'datetime', sortable: true },
  { key: 'subject', sortable: true },
  { key: 'audience', label: 'To', value: (r) => `${r.audience} (${r.recipientCount})` },
  { key: 'channels', value: (r) => r.channels.map((c) => channelMeta(c).label).join(', ') },
  { key: 'delivery', value: (r) => `${r.sent} sent, ${r.pending} pending, ${r.failed} failed, ${r.read}/${r.inApp} read` },
  { key: 'sentBy', label: 'By', sortable: true }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await notifications.history({
      search: search.value.trim() || undefined,
      templateId: filter.templateId,
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

const hasActiveFilter = computed(() => search.value !== '' || filter.templateId !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.templateId = undefined
}

onMounted(async () => {
  load()
  try {
    templatesList.value = (await notifications.templates({ size: 100, sortBy: 'name', sortOrder: 'asc' })).data
  } catch {
    templatesList.value = []
  }
})
</script>
