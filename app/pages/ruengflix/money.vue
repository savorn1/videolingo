<template>
  <div>
    <PageHeader
      title="Revenue & retention"
      description="RuengFlix's KHQR sales, coins and VIP, and how many viewers come back after signing up. Revenue counts paid orders by the day they were paid."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Revenue & retention' }]"
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Revenue · 30 days"
        icon="i-lucide-badge-dollar-sign"
        :value="d ? formatUsd(d.revenue30Days) : '—'"
        :sublabel="d ? `${formatUsd(d.revenue7Days)} in the last 7 days` : undefined"
        :loading="!d && !error"
      />
      <KpiTile
        label="Waiting for confirmation"
        icon="i-lucide-receipt"
        :value="d ? String(d.pendingOrders) : '—'"
        sublabel="KHQR orders not paid or confirmed yet"
        :loading="!d && !error"
      />
      <KpiTile label="VIP now" icon="i-lucide-crown" :value="d ? String(d.vipActive) : '—'" sublabel="viewers with VIP time left" :loading="!d && !error" />
      <KpiTile
        label="Coins held"
        icon="i-lucide-coins"
        :value="d ? d.coinsHeld.toLocaleString('en-US') : '—'"
        :sublabel="d ? `${d.coinsSpent30Days.toLocaleString('en-US')} spent on episodes in 30 days` : undefined"
        :loading="!d && !error"
      />
    </div>

    <UCard class="mb-4">
      <TrendChart v-if="d" title="Revenue per day" subtitle="Last 30 days" :items="revenueTrend" :format="(v: number) => formatUsd(v)" value-label="Revenue" />
      <DetailSkeleton v-else-if="!error" />
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <UCard>
        <template #header><h2 class="font-semibold">What sells · 30 days</h2></template>
        <RankedBarList v-if="byKind.length" :rows="byKind" :format="(v: number) => formatUsd(v)" />
        <p v-else class="text-sm text-muted">No sales yet.</p>
      </UCard>
      <UCard>
        <template #header><h2 class="font-semibold">Top series unlocks · 30 days</h2></template>
        <RankedBarList v-if="topSeries.length" :rows="topSeries" :format="(v: number) => formatUsd(v)" />
        <p v-else class="text-sm text-muted">No series bought yet.</p>
      </UCard>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Viewer accounts"
        icon="i-lucide-users"
        :value="d ? d.viewers.toLocaleString('en-US') : '—'"
        :sublabel="d ? `${d.newViewers7Days} new this week` : undefined"
        :loading="!d && !error"
      />
      <KpiTile label="Active today" icon="i-lucide-activity" :value="d ? String(d.activeToday) : '—'" sublabel="signed-in viewers" :loading="!d && !error" />
      <KpiTile
        label="Active · 7 days"
        icon="i-lucide-calendar-days"
        :value="d ? String(d.active7Days) : '—'"
        sublabel="signed-in viewers"
        :loading="!d && !error"
      />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Retention</h2>
        <p class="text-xs text-muted">
          Of the viewers who signed up in the last 60 days (and long enough ago), the share who used RuengFlix again exactly that many days later.
        </p>
      </template>
      <table class="w-full text-sm">
        <thead class="text-left text-muted">
          <tr>
            <th class="py-1 font-medium">Came back on</th>
            <th class="py-1 font-medium text-right">Signed up</th>
            <th class="py-1 font-medium text-right">Came back</th>
            <th class="py-1 font-medium text-right">Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in d?.retention ?? []" :key="r.day" class="border-t border-default">
            <td class="py-2">Day {{ r.day }}</td>
            <td class="py-2 text-right tabular-nums">{{ r.cohort }}</td>
            <td class="py-2 text-right tabular-nums">{{ r.returned }}</td>
            <td class="py-2 text-right tabular-nums font-medium text-highlighted">{{ retentionLabel(r.rate) }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { StreamingDashboard } from '~/composables/useStreaming'
import type { RankedRow } from '~/components/RankedBarList.vue'
import type { TrendItem } from '~/components/TrendChart.vue'
import { orderProduct, retentionLabel } from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const d = ref<StreamingDashboard | null>(null)
const error = ref('')

const KIND_LABELS = { COINS: 'Coin packs', SERIES: 'Series unlocks', VIP: 'VIP plans' } as const

// Every one of the last 30 days, with $0 on days without sales
const revenueTrend = computed<TrendItem[]>(() => {
  const byDay = new Map((d.value?.revenueByDay ?? []).map((r) => [r.day, r]))
  const out: TrendItem[] = []
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000)
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const r = byDay.get(key)
    out.push({
      key,
      label: day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tooltip: `${day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${r?.orders ?? 0} orders`,
      value: Number(r?.amountUsd ?? 0)
    })
  }
  return out
})

const byKind = computed<RankedRow[]>(() =>
  (d.value?.revenueByKind ?? []).map((k) => ({ key: k.kind, label: KIND_LABELS[k.kind], value: Number(k.amountUsd), sub: `${k.orders} orders` }))
)
const topSeries = computed<RankedRow[]>(() =>
  (d.value?.topSeries ?? []).map((s) => ({
    key: String(s.seriesId),
    label: orderProduct({ kind: 'SERIES', coins: null, months: null, seriesTitle: s.title }).replace(/^Series: /, ''),
    value: Number(s.amountUsd),
    sub: `${s.orders} unlocks`,
    to: `/ruengflix/${s.seriesId}`
  }))
)

onMounted(async () => {
  try {
    d.value = await streaming.dashboard()
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
})
</script>
