<template>
  <div>
    <PageHeader
      title="Comments"
      description="What viewers write under RuengFlix episodes. Five reports hide a comment until you decide; showing it again clears its reports."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Comments' }]"
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UTabs v-model="filter" :items="filterItems" :content="false" size="sm" />
      </div>

      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #body-data="{ row }">
          <p class="whitespace-pre-line break-words max-w-xl" :class="row.hiddenAt ? 'text-muted line-through' : 'text-highlighted'">{{ row.body }}</p>
          <p class="text-xs text-muted mt-1">
            {{ row.viewerName }} on
            <NuxtLink :to="`/ruengflix/${row.seriesId}`" class="underline">{{ row.seriesTitle }}</NuxtLink>
            · episode {{ row.episode }}
          </p>
        </template>
        <template #reportCount-data="{ row }">
          <UBadge v-if="row.reportCount" color="warning" variant="subtle">{{ row.reportCount }} report{{ row.reportCount === 1 ? '' : 's' }}</UBadge>
          <p v-if="row.hiddenAt" class="text-xs text-muted mt-1">Hidden {{ row.hiddenBy === 'reports' ? 'by reports' : `by ${row.hiddenBy}` }}</p>
        </template>
        <template #createdAt-data="{ row }">
          <span :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
        </template>
        <template #actions-data="{ row }">
          <template v-if="canWrite">
            <UButton
              v-if="!row.hiddenAt"
              size="xs"
              color="error"
              variant="soft"
              icon="i-lucide-eye-off"
              :loading="busyId === row.id"
              @click="setHidden(row, true)"
              >Hide</UButton
            >
            <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-eye" :loading="busyId === row.id" @click="setHidden(row, false)"
              >Show</UButton
            >
          </template>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-message-square"
            :title="filter === 'reported' ? 'Nothing reported' : filter === 'hidden' ? 'No hidden comments' : 'No comments yet'"
            description="Signed-in viewers comment under each episode on RuengFlix."
          />
        </template>
      </DataTable>
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { CommentFilter, StreamingComment } from '~/composables/useStreaming'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingComment[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const filter = ref<CommentFilter>('reported')
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)

const filterItems = [
  { label: 'Reported', value: 'reported' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'All', value: 'all' }
]

const columns: ColumnDef<StreamingComment>[] = [
  { key: 'body', label: 'Comment', value: (r) => r.body },
  { key: 'reportCount', label: 'Reports', value: (r) => String(r.reportCount) },
  { key: 'createdAt', label: 'Posted' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await streaming.comments({ filter: filter.value, page: page.value, size: pageSize.value })
    rows.value = res.items
    total.value = res.total
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function setHidden(row: StreamingComment, hidden: boolean) {
  busyId.value = row.id
  try {
    await streaming.setCommentHidden(row.id, hidden)
    toast.add({ title: hidden ? 'Comment hidden from RuengFlix' : 'Comment shown again', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update the comment', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

watch(filter, () => {
  page.value = 1
  load()
})
watch([page, pageSize], load)
onMounted(load)
</script>
