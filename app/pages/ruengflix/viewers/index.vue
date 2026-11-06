<template>
  <div>
    <PageHeader
      title="Viewers"
      description="Accounts viewers created on RuengFlix with a phone number and password, Telegram or Google. Their saved series, history and unlocks sync to the account."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Viewers' }]"
    />

    <UAlert
      class="mb-4"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      description="Phone numbers aren't verified by SMS yet, so a number shows what the viewer typed, not proof it's theirs."
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Name, phone, Telegram or email" aria-label="Search viewers" class="w-72" />
        <UTabs v-model="status" :items="statusItems" :content="false" size="sm" />
      </div>

      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #displayName-data="{ row }">
          <NuxtLink :to="`/ruengflix/viewers/${row.id}`" class="font-medium text-highlighted hover:underline">{{ row.displayName }}</NuxtLink>
          <p class="text-xs text-muted tabular-nums">{{ viewerSignInLabel(row) }}</p>
        </template>
        <template #disabled-data="{ row }">
          <UBadge :color="row.disabled ? 'error' : 'success'" variant="subtle">{{ row.disabled ? 'Disabled' : 'Active' }}</UBadge>
        </template>
        <template #lastLoginAt-data="{ row }">
          <span :title="formatDateTime(row.lastLoginAt)">{{ row.lastLoginAt ? formatRelativeTime(row.lastLoginAt) : 'Never' }}</span>
        </template>
        <template #librarySyncedAt-data="{ row }">
          <span :title="formatDateTime(row.librarySyncedAt)">{{ row.librarySyncedAt ? formatRelativeTime(row.librarySyncedAt) : '—' }}</span>
        </template>
        <template #actions-data="{ row }">
          <template v-if="canWrite">
            <UButton v-if="!row.disabled" size="xs" color="error" variant="soft" icon="i-lucide-ban" @click="confirmDisable = row">Disable</UButton>
            <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :loading="busyId === row.id" @click="setDisabled(row, false)"
              >Enable</UButton
            >
          </template>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-user-round"
            :title="q || status !== 'all' ? 'No matching viewers' : 'No viewer accounts yet'"
            description="Viewers create accounts from RuengFlix's Me page or the header's Log in button."
          />
        </template>
      </DataTable>
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </UCard>

    <ConfirmModal
      :model-value="confirmDisable !== null"
      title="Disable viewer"
      :description="`Disable ${confirmDisable?.displayName ?? ''} (${confirmDisable ? viewerSignInLabel(confirmDisable) : ''})? They're signed out of RuengFlix on every device and can't sign in until you enable them again. Their library is kept.`"
      confirm-label="Disable"
      color="error"
      :loading="busyId !== null"
      @update:model-value="(v: boolean) => !v && busyId === null && (confirmDisable = null)"
      @confirm="confirmDisable && setDisabled(confirmDisable, true)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { ViewerAccount, ViewerStatusFilter } from '~/composables/useStreaming'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<ViewerAccount[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const q = ref('')
const status = ref<ViewerStatusFilter>('all')
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)
const confirmDisable = ref<ViewerAccount | null>(null)

const statusItems = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Disabled', value: 'disabled' }
]

const columns: ColumnDef<ViewerAccount>[] = [
  { key: 'displayName', label: 'Viewer', value: (r) => `${r.displayName} · ${viewerSignInLabel(r)}` },
  { key: 'disabled', label: 'Status', value: (r) => (r.disabled ? 'Disabled' : 'Active') },
  { key: 'createdAt', label: 'Joined', type: 'datetime' },
  { key: 'lastLoginAt', label: 'Last sign-in' },
  { key: 'librarySyncedAt', label: 'Library synced' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await streaming.viewers({ q: q.value.trim() || undefined, status: status.value, page: page.value, size: pageSize.value })
    rows.value = res.items
    total.value = res.total
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function setDisabled(row: ViewerAccount, disabled: boolean) {
  busyId.value = row.id
  try {
    await streaming.setViewerDisabled(row.id, disabled)
    toast.add({ title: disabled ? `${row.displayName} disabled and signed out` : `${row.displayName} can sign in again`, color: 'success' })
    confirmDisable.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update the viewer', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

// Search as they type, a moment after they stop
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})
watch(status, () => {
  page.value = 1
  load()
})
watch([page, pageSize], load)

onMounted(load)
</script>
