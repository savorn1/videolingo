<template>
  <div>
    <PageHeader title="Notifications" description="Every delivery — one row per recipient and channel.">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-history" to="/notifications/history">History</UButton>
        <UButton icon="i-lucide-send" to="/notifications/send">Send notification</UButton>
      </template>
    </PageHeader>

    <UCard v-if="batch" class="mb-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-xs text-gray-500">Send #{{ batch.id }} · {{ formatDateTime(batch.createdAt) }} by {{ batch.sentBy ?? '—' }}</p>
          <p class="font-semibold text-gray-900 dark:text-white truncate">{{ batch.subject }}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ batch.audience }} · {{ batch.channels.map((c) => channelMeta(c).label).join(' + ') }}
            <template v-if="batch.templateName"> · template “{{ batch.templateName }}”</template>
          </p>
        </div>
        <div class="flex items-center gap-3">
          <NotificationBatchStats :batch="batch" />
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="filter.batchId = undefined">Show all</UButton>
        </div>
      </div>
    </UCard>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search subject or recipient" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.channel" :items="channelOptions" placeholder="Channel" class="w-36" aria-label="Channel" />
        <USelect v-model="filter.status" :items="statusOptions" placeholder="Status" class="w-36" aria-label="Status" />
        <USelect v-model="filter.read" :items="readOptions" placeholder="Read" class="w-36" aria-label="Read state" />
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
        export-filename="notifications"
        @refresh="load"
        @select="(row: AppNotification) => navigateTo(`/notifications/${row.id}`)"
      >
        <template #subject-data="{ row }">
          <div class="min-w-0 max-w-md">
            <NuxtLink :to="`/notifications/${row.id}`" class="font-medium text-gray-900 dark:text-white hover:underline line-clamp-1" @click.stop>{{
              row.subject
            }}</NuxtLink>
            <p class="text-xs text-gray-500 line-clamp-1">{{ row.body }}</p>
          </div>
        </template>
        <template #recipientUsername-data="{ row }">
          <div class="min-w-0">
            <UserChip :name="row.recipientUsername" />
            <p v-if="row.channel === 'EMAIL'" class="text-xs text-gray-500 truncate mt-0.5">{{ row.recipientEmail ?? 'no email' }}</p>
          </div>
        </template>
        <template #channel-data="{ row }">
          <UBadge color="neutral" variant="subtle" size="sm" :icon="channelMeta(row.channel).icon">{{ channelMeta(row.channel).label }}</UBadge>
        </template>
        <template #status-data="{ row }">
          <div class="flex items-center gap-1.5">
            <UBadge
              :color="notificationStatusMeta(row.status).color"
              variant="subtle"
              size="sm"
              :icon="notificationStatusMeta(row.status).icon"
              :title="row.errorMessage ?? undefined"
            >
              {{ notificationStatusMeta(row.status).label }}
            </UBadge>
            <UIcon
              v-if="row.channel === 'IN_APP' && row.readAt"
              name="i-lucide-eye"
              class="w-3.5 h-3.5 text-gray-400"
              :title="`Read ${formatDateTime(row.readAt)}`"
            />
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No notifications match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            icon="i-lucide-bell"
            title="No notifications yet"
            description="Anything you send shows up here, one row per recipient and channel."
          >
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
import type { NotificationChannel, NotificationStatus } from '#shared/utils/notifications'
import type { AppNotification, NotificationBatch } from '~/composables/useNotifications'

definePageMeta({ middleware: 'admin' })

const notifications = useNotifications()

const rows = ref<AppNotification[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const batch = ref<NotificationBatch | null>(null)

const filter = reactive<{
  channel: NotificationChannel | undefined
  status: NotificationStatus | undefined
  read: boolean | undefined
  batchId: number | undefined
  recipientId: number | undefined
}>({ channel: undefined, status: undefined, read: undefined, batchId: undefined, recipientId: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'createdAt', direction: 'desc' })

useListQuerySync({ filter, search, page })

const channelOptions = [{ label: 'Any channel', value: undefined }, ...NOTIFICATION_CHANNELS.map((c) => ({ label: c.label, value: c.value }))]
const statusOptions = [{ label: 'Any status', value: undefined }, ...NOTIFICATION_STATUSES.map((s) => ({ label: s.label, value: s.value }))]
const readOptions = [
  { label: 'Read or unread', value: undefined },
  { label: 'Unread (in-app)', value: false },
  { label: 'Read (in-app)', value: true }
]

const columns: ColumnDef<AppNotification>[] = [
  { key: 'createdAt', label: 'Sent', type: 'datetime', sortable: true },
  { key: 'subject', sortable: true, value: (r) => r.subject },
  { key: 'recipientUsername', label: 'Recipient', sortable: true },
  { key: 'channel', sortable: true, value: (r) => channelMeta(r.channel).label },
  { key: 'status', sortable: true, value: (r) => notificationStatusMeta(r.status).label },
  { key: 'readAt', label: 'Read', type: 'datetime', sortable: true },
  { key: 'sentBy', label: 'By' }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const [res, b] = await Promise.all([
      notifications.list({
        search: search.value.trim() || undefined,
        ...filter,
        sortBy: sort.value?.column,
        sortOrder: sort.value?.direction,
        page: page.value,
        size: pageSize.value
      }),
      filter.batchId ? notifications.batch(filter.batchId) : Promise.resolve(null)
    ])
    if (seq !== requestSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
    batch.value = b
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

// Pending emails settle within seconds — refresh once while any are shown.
let pendingTimer: ReturnType<typeof setTimeout> | undefined
watch(rows, (list) => {
  clearTimeout(pendingTimer)
  if (list.some((n) => n.status === 'PENDING')) pendingTimer = setTimeout(load, 3000)
})
onBeforeUnmount(() => clearTimeout(pendingTimer))

const hasActiveFilter = computed(
  () => search.value !== '' || filter.channel !== undefined || filter.status !== undefined || filter.read !== undefined || filter.recipientId !== undefined
)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.channel = undefined
  filter.status = undefined
  filter.read = undefined
  filter.recipientId = undefined
}

onMounted(load)
</script>
