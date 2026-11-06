<template>
  <div>
    <PageHeader
      :title="data?.viewer.displayName ?? 'Viewer'"
      description="A RuengFlix viewer's money for support cases: wallet, payments, unlocks and coin history. Give coins or refund a payment here; return refunded money in the bank app."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Viewers', to: '/ruengflix/viewers' }, { label: data?.viewer.displayName ?? '…' }]"
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <template v-if="data">
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <KpiTile label="Coins" icon="i-lucide-coins" :value="data.wallet.coins.toLocaleString('en-US')" sublabel="in the wallet now" />
        <KpiTile
          label="VIP"
          icon="i-lucide-crown"
          :value="data.wallet.vipActive ? 'Active' : 'No'"
          :sublabel="data.wallet.vipUntil ? `${data.wallet.vipActive ? 'until' : 'ended'} ${formatDateTime(data.wallet.vipUntil)}` : 'never had VIP'"
        />
        <KpiTile
          label="Paid"
          icon="i-lucide-badge-dollar-sign"
          :value="formatUsd(paidTotal)"
          :sublabel="`${paidCount} paid order${paidCount === 1 ? '' : 's'}`"
        />
        <KpiTile
          label="Invites"
          icon="i-lucide-gift"
          :value="String(data.invites.joined)"
          :sublabel="`${data.invites.rewarded} rewarded${data.invites.invitedByName ? ` · invited by ${data.invites.invitedByName}` : ''}`"
        />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <UCard>
          <template #header><h2 class="font-semibold">Account</h2></template>
          <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt class="text-muted">Sign-in</dt>
            <dd>{{ viewerSignInLabel(data.viewer) }}</dd>
            <dt class="text-muted">Status</dt>
            <dd>
              <UBadge :color="data.viewer.disabled ? 'error' : 'success'" variant="subtle">{{ data.viewer.disabled ? 'Disabled' : 'Active' }}</UBadge>
            </dd>
            <dt class="text-muted">Joined</dt>
            <dd>{{ formatDateTime(data.viewer.createdAt) }}</dd>
            <dt class="text-muted">Last sign-in</dt>
            <dd>{{ data.viewer.lastLoginAt ? formatRelativeTime(data.viewer.lastLoginAt) : 'Never' }}</dd>
            <dt class="text-muted">Invite code</dt>
            <dd class="tabular-nums">{{ data.invites.code ?? '—' }}</dd>
          </dl>
        </UCard>

        <UCard class="lg:col-span-2">
          <template #header>
            <h2 class="font-semibold">Give or take back coins</h2>
            <p class="text-xs text-muted">
              For support cases: a payment that wasn't delivered, a goodwill gesture, a mistake. A negative number takes coins back (never below 0). Saved in
              the coin history with your name.
            </p>
          </template>
          <form class="flex flex-wrap items-end gap-3" @submit.prevent="grant">
            <UFormField label="Coins">
              <UInputNumber v-model="coins" :min="-10000" :max="10000" :step="10" :disabled="!canWrite" class="w-40" />
            </UFormField>
            <UFormField label="Reason" class="flex-1 min-w-60">
              <UInput v-model="reason" placeholder="e.g. Paid 0.99 on 3 Nov, coins never arrived" :maxlength="200" :disabled="!canWrite" class="w-full" />
            </UFormField>
            <UButton type="submit" icon="i-lucide-coins" :loading="granting" :disabled="!canWrite">{{ (coins ?? 0) < 0 ? 'Take back' : 'Give coins' }}</UButton>
          </form>
          <p v-if="grantTried && grantErrors.length" class="text-sm text-error mt-2">{{ grantErrors.join(' ') }}</p>
        </UCard>
      </div>

      <UCard class="mb-4">
        <template #header><h2 class="font-semibold">Payments</h2></template>
        <DataTable :rows="data.orders" :columns="orderColumns" :loading="false">
          <template #product-data="{ row }">
            <p class="font-medium text-highlighted">{{ orderProduct(row) }}</p>
            <p class="text-xs text-muted tabular-nums">{{ row.billNumber }}</p>
          </template>
          <template #amountUsd-data="{ row }">
            <span class="tabular-nums">{{ formatUsd(row.amountUsd) }}</span>
          </template>
          <template #status-data="{ row }">
            <UBadge :color="ORDER_STATUS_META[row.status].color" variant="subtle">{{ ORDER_STATUS_META[row.status].label }}</UBadge>
            <p v-if="row.refundReason" class="text-xs text-muted mt-1">{{ row.refundedBy }}: {{ row.refundReason }}</p>
          </template>
          <template #createdAt-data="{ row }">
            <span :title="formatDateTime(row.createdAt)">{{ formatRelativeTime(row.createdAt) }}</span>
          </template>
          <template #actions-data="{ row }">
            <UButton v-if="canRefund && row.status === 'PAID'" size="xs" color="error" variant="soft" icon="i-lucide-undo-2" @click="refunding = row"
              >Refund</UButton
            >
          </template>
          <template #empty-state>
            <EmptyState icon="i-lucide-receipt" title="No payments" description="This viewer hasn't started a KHQR payment." />
          </template>
        </DataTable>
      </UCard>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard>
          <template #header><h2 class="font-semibold">Coin history</h2></template>
          <ul v-if="data.ledger.length" class="divide-y divide-default text-sm">
            <li v-for="l in data.ledger" :key="l.id" class="flex items-center gap-3 py-2">
              <span class="tabular-nums font-semibold w-16 text-right" :class="l.delta > 0 ? 'text-success' : 'text-error'"
                >{{ l.delta > 0 ? '+' : '' }}{{ l.delta }}</span
              >
              <span class="flex-1 min-w-0">
                {{ LEDGER_REASONS[l.reason] ?? l.reason }}
                <span v-if="l.reason === 'ADMIN' && l.ref" class="block text-xs text-muted truncate">{{ l.ref }}</span>
              </span>
              <span class="text-xs text-muted" :title="formatDateTime(l.createdAt)">{{ formatRelativeTime(l.createdAt) }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No coin activity yet.</p>
        </UCard>
        <UCard>
          <template #header><h2 class="font-semibold">Unlocked</h2></template>
          <ul v-if="data.unlocks.length" class="divide-y divide-default text-sm">
            <li v-for="u in data.unlocks" :key="`${u.seriesId}-${u.episode}`" class="flex items-center gap-3 py-2">
              <NuxtLink :to="`/ruengflix/${u.seriesId}`" class="flex-1 min-w-0 truncate hover:underline">{{ u.seriesTitle ?? 'Deleted series' }}</NuxtLink>
              <span>{{ u.episode === 0 ? 'Whole series' : `Episode ${u.episode}` }}</span>
              <UBadge color="neutral" variant="subtle" size="sm">{{ u.source === 'COINS' ? 'Coins' : 'KHQR' }}</UBadge>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">Nothing unlocked one by one or bought. VIP time opens everything while it lasts.</p>
        </UCard>
      </div>
    </template>
    <DetailSkeleton v-else-if="!error" />

    <UModal :open="refunding !== null" title="Refund payment" @update:open="(v: boolean) => !v && !refundBusy && (refunding = null)">
      <template #body>
        <div v-if="refunding" class="space-y-3 text-sm">
          <p>
            Refund <strong>{{ orderProduct(refunding) }}</strong> ({{ formatUsd(refunding.amountUsd) }}, {{ refunding.billNumber }}). RuengFlix takes back what
            it delivered:
            {{ refundEffect(refunding) }}
          </p>
          <p class="text-muted">Send the money back to the viewer in your bank app; RuengFlix can't do that part.</p>
          <UFormField label="Reason" required>
            <UInput v-model="refundReason" placeholder="e.g. Paid twice by mistake" :maxlength="300" class="w-full" autofocus />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" :disabled="refundBusy" @click="refunding = null">Keep it</UButton>
          <UButton color="error" icon="i-lucide-undo-2" :loading="refundBusy" :disabled="refundReason.trim().length < 3" @click="refund">Refund</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { StreamingOrder, ViewerMoney } from '~/composables/useStreaming'
import { LEDGER_REASONS, ORDER_STATUS_META, coinGrantProblems, orderProduct } from '#shared/utils/ruengflix'
import { viewerSignInLabel } from '#shared/utils/viewerSignIn'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))
// Refunds go to "/reverse", an approval-type action in the permission check
const canRefund = computed(() => can('streaming', 'APPROVE'))
const viewerId = computed(() => Number(route.params.id))

const data = ref<ViewerMoney | null>(null)
const error = ref('')
const coins = ref<number | null>(null)
const reason = ref('')
const granting = ref(false)
const grantTried = ref(false)
const refunding = ref<StreamingOrder | null>(null)
const refundReason = ref('')
const refundBusy = ref(false)

const paid = computed(() => data.value?.orders.filter((o) => o.status === 'PAID') ?? [])
const paidCount = computed(() => paid.value.length)
const paidTotal = computed(() => paid.value.reduce((n, o) => n + Number(o.amountUsd), 0))
const grantErrors = computed(() => coinGrantProblems(coins.value, reason.value))

const orderColumns: ColumnDef<StreamingOrder>[] = [
  { key: 'product', label: 'Order', value: (r) => `${orderProduct(r)} · ${r.billNumber}` },
  { key: 'amountUsd', label: 'Amount', value: (r) => formatUsd(r.amountUsd) },
  { key: 'status', label: 'Status', value: (r) => ORDER_STATUS_META[r.status].label },
  { key: 'createdAt', label: 'Started' },
  { key: 'actions', label: '' }
]

function refundEffect(o: StreamingOrder) {
  if (o.kind === 'COINS') return `${((o.coins ?? 0) + (o.bonusCoins ?? 0)).toLocaleString('en-US')} coins, or as many as are left.`
  if (o.kind === 'VIP') return `${o.months} month${o.months === 1 ? '' : 's'} of VIP time.`
  return 'the series unlock.'
}

async function load() {
  error.value = ''
  try {
    data.value = await streaming.viewerMoney(viewerId.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}

async function grant() {
  grantTried.value = true
  if (grantErrors.value.length || coins.value == null) return
  granting.value = true
  try {
    data.value = await streaming.grantCoins(viewerId.value, coins.value, reason.value.trim())
    toast.add({ title: coins.value > 0 ? `Gave ${coins.value} coins` : `Took back up to ${-coins.value} coins`, color: 'success' })
    coins.value = null
    reason.value = ''
    grantTried.value = false
  } catch (err) {
    toast.add({ title: 'Could not change the coins', description: apiErrorMessage(err), color: 'error' })
  } finally {
    granting.value = false
  }
}

async function refund() {
  const o = refunding.value
  if (!o) return
  refundBusy.value = true
  try {
    await streaming.refundOrder(o.id, refundReason.value.trim())
    toast.add({ title: `${o.billNumber} refunded`, description: 'Now send the money back in the bank app.', color: 'success' })
    refunding.value = null
    refundReason.value = ''
    await load()
  } catch (err) {
    toast.add({ title: 'Could not refund', description: apiErrorMessage(err), color: 'error' })
  } finally {
    refundBusy.value = false
  }
}

onMounted(load)
</script>
