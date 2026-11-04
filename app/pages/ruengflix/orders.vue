<template>
  <div>
    <PageHeader
      title="Orders"
      description="KHQR payments on RuengFlix: coin packs, series unlocks and VIP plans. Paid orders are delivered to the viewer's account right away."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Orders' }]"
    />

    <UAlert
      class="mb-4"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      description="With a Bakong token on movie-api, payments confirm themselves. Without one, check the payment in your bank app (amount and bill number), then Mark paid."
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Bill number or viewer" aria-label="Search orders" class="w-72" />
        <UTabs v-model="status" :items="statusItems" :content="false" size="sm" />
      </div>

      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #product-data="{ row }">
          <p class="font-medium text-highlighted">{{ orderProduct(row) }}</p>
          <p class="text-xs text-muted tabular-nums">{{ row.billNumber }} · {{ row.viewerName ?? 'Deleted account' }}</p>
        </template>
        <template #amountUsd-data="{ row }">
          <span class="tabular-nums">{{ formatUsd(row.amountUsd) }}</span>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="ORDER_STATUS_META[row.status].color" variant="subtle">{{ ORDER_STATUS_META[row.status].label }}</UBadge>
          <p v-if="row.paidBy" class="text-xs text-muted mt-1">{{ row.paidBy === 'bakong' ? 'Confirmed by Bakong' : `By ${row.paidBy}` }}</p>
        </template>
        <template #createdAt-data="{ row }">
          <span :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
        </template>
        <template #actions-data="{ row }">
          <div v-if="canWrite && (row.status === 'PENDING' || row.status === 'EXPIRED')" class="flex gap-1 justify-end">
            <UButton size="xs" color="success" variant="soft" icon="i-lucide-check" @click="confirm = { row, action: 'paid' }">Mark paid</UButton>
            <UButton v-if="canCancel" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="confirm = { row, action: 'cancel' }">Cancel</UButton>
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-receipt"
            :title="q || status !== 'all' ? 'No matching orders' : 'No orders yet'"
            description="Orders appear when viewers start a KHQR payment on RuengFlix."
          />
        </template>
      </DataTable>
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
    </UCard>

    <ConfirmModal
      :model-value="confirm !== null"
      :title="confirm?.action === 'paid' ? 'Confirm payment' : 'Cancel order'"
      :description="confirmText"
      :confirm-label="confirm?.action === 'paid' ? 'Mark paid' : 'Cancel order'"
      :color="confirm?.action === 'paid' ? 'success' : 'error'"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirm = null)"
      @confirm="confirm && act(confirm.row, confirm.action)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { OrderStatus, StreamingOrder } from '~/composables/useStreaming'
import { ORDER_STATUS_META, orderProduct } from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))
// "cancel" is an approval-type action in the permission check
const canCancel = computed(() => can('streaming', 'APPROVE'))

const rows = ref<StreamingOrder[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const q = ref('')
const status = ref<OrderStatus | 'all'>('PENDING')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const confirm = ref<{ row: StreamingOrder; action: 'paid' | 'cancel' } | null>(null)

const statusItems = [
  { label: 'Waiting', value: 'PENDING' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'All', value: 'all' }
]

const columns: ColumnDef<StreamingOrder>[] = [
  { key: 'product', label: 'Order', value: (r) => `${orderProduct(r)} · ${r.billNumber}` },
  { key: 'amountUsd', label: 'Amount', value: (r) => formatUsd(r.amountUsd) },
  { key: 'status', label: 'Status', value: (r) => ORDER_STATUS_META[r.status].label },
  { key: 'createdAt', label: 'Started' },
  { key: 'actions', label: '' }
]

const confirmText = computed(() => {
  const c = confirm.value
  if (!c) return ''
  return c.action === 'paid'
    ? `Only confirm after you see ${formatUsd(c.row.amountUsd)} with bill number ${c.row.billNumber} in the bank app. ${c.row.viewerName ?? 'The viewer'} gets ${orderProduct(c.row)} right away.`
    : `Cancel ${c.row.billNumber}? Do this when the viewer didn't pay. Nothing is delivered.`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await streaming.orders({ status: status.value, q: q.value.trim() || undefined, page: page.value, size: pageSize.value })
    rows.value = res.items
    total.value = res.total
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function act(row: StreamingOrder, action: 'paid' | 'cancel') {
  busy.value = true
  try {
    if (action === 'paid') await streaming.markOrderPaid(row.id)
    else await streaming.cancelOrder(row.id)
    toast.add({ title: action === 'paid' ? `${row.billNumber} confirmed and delivered` : `${row.billNumber} cancelled`, color: 'success' })
    confirm.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not update the order', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

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
