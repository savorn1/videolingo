<template>
  <div>
    <PageHeader
      title="AI usage & cost"
      description="Every Claude request — generations and chat — with its tokens and cost."
      :crumbs="[{ label: 'AI Studio', to: '/ai' }, { label: 'Usage & cost' }]"
    />

    <UCard class="mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <USelect v-model="range" :items="rangeOptions" class="w-44" aria-label="Date range" />
        <span class="text-sm text-gray-500">{{ formatDate(summary?.from) }} – {{ formatDate(summary?.to) }}</span>
        <UButton class="ml-auto" size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="loadingSummary" @click="refreshAll"
          >Refresh</UButton
        >
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <StatTile
        label="Cost"
        :value="formatUsd(summary?.costUsd)"
        :sublabel="summary ? `${formatUsd(summary.avgCostPerRequestUsd)} per request` : undefined"
        icon="i-lucide-dollar-sign"
        :loading="!summary"
      />
      <StatTile
        label="Requests"
        :value="String(summary?.requests ?? '—')"
        :sublabel="summary ? `${summary.errors} failed · ${summary.refusals} declined` : undefined"
        icon="i-lucide-activity"
        color="info"
        :loading="!summary"
      />
      <StatTile
        label="Tokens"
        :value="summary ? `${formatTokens(totalInput)} / ${formatTokens(summary.outputTokens)}` : '—'"
        sublabel="input / output"
        icon="i-lucide-binary"
        color="neutral"
        :loading="!summary"
      />
      <StatTile
        label="Cache hit rate"
        :value="formatPercent(summary?.cacheHitRate)"
        :sublabel="summary ? `${formatUsd(summary.cacheSavingsUsd)} saved by prompt caching` : undefined"
        icon="i-lucide-zap"
        color="success"
        :loading="!summary"
      />
    </div>

    <UCard v-if="status?.monthlyBudgetUsd" class="mb-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <strong class="text-gray-900 dark:text-white">{{ formatUsd(status.monthSpendUsd) }}</strong> of the {{ formatUsd(status.monthlyBudgetUsd) }} monthly
          budget
        </p>
        <UBadge :color="status.budgetEnforced ? 'neutral' : 'warning'" variant="subtle" size="sm">{{
          status.budgetEnforced ? 'Enforced' : 'Soft limit'
        }}</UBadge>
      </div>
      <UProgress
        :model-value="budgetPercent"
        :color="budgetPercent >= 100 ? 'error' : budgetPercent >= 80 ? 'warning' : 'primary'"
        size="sm"
        class="mt-2"
        :aria-label="`${budgetPercent}% of budget used`"
      />
    </UCard>

    <UAlert
      v-if="summary?.unpricedRequests"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-circle-help"
      :title="`${summary.unpricedRequests} request(s) used a model with no configured price`"
      description="Their cost isn't counted. Add ai.pricing.<model> in the backend's application.properties."
    />

    <UCard class="mb-4">
      <USkeleton v-if="!summary" class="h-52" />
      <TrendChart v-else :title="`Cost per ${dailyCost.per}`" :items="dailyCost.items" :format="(v: number) => formatUsd(v)" value-label="Cost" />
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <AiUsageBreakdown title="By feature" :rows="summary?.byFeature ?? []" :label="aiFeatureLabel" :icon="aiFeatureIcon" />
      <AiUsageBreakdown title="By model" :rows="summary?.byModel ?? []" mono />
      <AiUsageBreakdown title="Top users" :rows="summary?.byUser ?? []" />
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="font-semibold text-gray-900 dark:text-white mr-auto">Request log</h2>
          <USelect v-model="logFilter.feature" :items="featureOptions" placeholder="Feature" class="w-36" aria-label="Feature" />
          <USelect v-model="logFilter.status" :items="statusOptions" placeholder="Status" class="w-36" aria-label="Status" />
          <USelect v-model="logFilter.model" :items="modelOptions" placeholder="Model" class="w-44" aria-label="Model" />
          <UButton v-if="hasLogFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearLogFilter">Clear</UButton>
        </div>
      </template>
      <DataTable v-model:sort="sort" :rows="rows" :columns="columns" :loading="loadingLog" exportable export-filename="ai-usage">
        <template #feature-data="{ row }">
          <span class="flex items-center gap-1.5">
            <UIcon :name="aiFeatureIcon(row.feature)" class="w-3.5 h-3.5 text-gray-400" />
            {{ aiFeatureLabel(row.feature) }}
          </span>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="statusColor(row.status)" variant="subtle" size="sm" :title="row.errorMessage ?? undefined">{{ formatEnum(row.status) }}</UBadge>
        </template>
        <template #model-data="{ row }">
          <span class="font-mono text-xs">{{ row.model ?? '—' }}</span>
          <UBadge v-if="row.fallbackFrom" color="warning" variant="subtle" size="sm" class="ml-1" :title="`${row.fallbackFrom} declined first`"
            >fallback</UBadge
          >
        </template>
        <template #videoId-data="{ row }">
          <NuxtLink
            v-if="row.videoId"
            :to="`/ai/videos/${row.videoId}${row.feature === 'CHAT' ? '?tab=chat' : ''}`"
            class="text-primary-600 dark:text-primary-400 hover:underline"
          >
            #{{ row.videoId }}
          </NuxtLink>
          <span v-else>—</span>
        </template>
        <template #errorMessage-data="{ row }">
          <span class="text-xs text-gray-500 line-clamp-2 max-w-xs" :title="row.errorMessage ?? undefined">{{ row.errorMessage ?? '' }}</span>
        </template>
      </DataTable>
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" class="mt-3" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { AiFeature } from '#shared/utils/ai'
import type { AiStatus, AiUsage, AiUsageStatus, AiUsageSummary } from '~/composables/useAi'

definePageMeta({ middleware: 'admin' })

const ai = useAi()

type RangeKey = 'month' | 'prev-month' | '7d' | '30d' | '90d'
const range = ref<RangeKey>('month')
const rangeOptions: { label: string; value: RangeKey }[] = [
  { label: 'This month', value: 'month' },
  { label: 'Last month', value: 'prev-month' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' }
]

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dates = computed(() => {
  const today = new Date()
  const daysBack = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1))
  switch (range.value) {
    case 'prev-month':
      return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) }
    case '7d':
      return { from: iso(daysBack(7)), to: iso(today) }
    case '30d':
      return { from: iso(daysBack(30)), to: iso(today) }
    case '90d':
      return { from: iso(daysBack(90)), to: iso(today) }
    default:
      return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) }
  }
})

const summary = ref<AiUsageSummary | null>(null)
const status = ref<AiStatus | null>(null)
const loadingSummary = ref(false)
const error = ref('')

const dailyCost = computed(() => trendItems((summary.value?.daily ?? []).map((d) => ({ date: d.date, value: d.costUsd }))))
const totalInput = computed(() => (summary.value ? summary.value.inputTokens + summary.value.cacheWriteTokens + summary.value.cacheReadTokens : 0))
const budgetPercent = computed(() => {
  const s = status.value
  if (!s?.monthlyBudgetUsd) return 0
  return Math.min(100, Math.round((s.monthSpendUsd / s.monthlyBudgetUsd) * 100))
})

let summarySeq = 0
async function loadSummary() {
  const seq = ++summarySeq
  loadingSummary.value = true
  error.value = ''
  try {
    const [s, st] = await Promise.all([ai.usageSummary(dates.value.from, dates.value.to), ai.status()])
    if (seq !== summarySeq) return
    summary.value = s
    status.value = st
  } catch (err) {
    if (seq === summarySeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === summarySeq) loadingSummary.value = false
  }
}

// ── request log ─────────────────────────────────────────────────────────

const logFilter = reactive<{ feature?: AiFeature; status?: AiUsageStatus; model?: string }>({})
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'createdAt', direction: 'desc' })
const page = ref(1)
const pageSize = ref(20)
const rows = ref<AiUsage[]>([])
const total = ref(0)
const loadingLog = ref(false)

const featureOptions = [...AI_TASKS.map((t) => ({ label: t.label, value: t.value as AiFeature })), { label: 'Chat', value: 'CHAT' as AiFeature }]
const statusOptions: { label: string; value: AiUsageStatus }[] = [
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Declined', value: 'REFUSED' },
  { label: 'Cut off', value: 'TRUNCATED' },
  { label: 'Error', value: 'ERROR' }
]
const modelOptions = computed(() => {
  const models = new Set([...(summary.value?.byModel.map((m) => m.key) ?? []), ...Object.keys(status.value?.pricing ?? {})])
  return [...models].map((m) => ({ label: m, value: m }))
})
const hasLogFilter = computed(() => !!(logFilter.feature || logFilter.status || logFilter.model))

function clearLogFilter() {
  logFilter.feature = undefined
  logFilter.status = undefined
  logFilter.model = undefined
}

const columns: ColumnDef<AiUsage>[] = [
  { key: 'createdAt', label: 'When', type: 'datetime', sortable: true },
  { key: 'feature', sortable: true },
  { key: 'status', sortable: true },
  { key: 'model', sortable: true },
  { key: 'videoId', label: 'Video' },
  { key: 'username', label: 'User' },
  { key: 'inputTokens', label: 'Input', sortable: true, value: (r) => formatTokens(r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens) },
  { key: 'cacheReadTokens', label: 'Cached', value: (r) => formatTokens(r.cacheReadTokens) },
  { key: 'outputTokens', label: 'Output', sortable: true, value: (r) => formatTokens(r.outputTokens) },
  { key: 'costUsd', label: 'Cost', sortable: true, value: (r) => formatUsd(r.costUsd) },
  { key: 'latencyMs', label: 'Latency', sortable: true, value: (r) => (r.latencyMs === null ? '—' : `${(r.latencyMs / 1000).toFixed(1)}s`) },
  { key: 'errorMessage', label: 'Details' }
]

function statusColor(s: string): 'success' | 'warning' | 'error' | 'neutral' {
  return s === 'SUCCESS' ? 'success' : s === 'REFUSED' || s === 'TRUNCATED' ? 'warning' : 'error'
}

let logSeq = 0
async function loadLog() {
  const seq = ++logSeq
  loadingLog.value = true
  try {
    const res = await ai.usage({
      ...logFilter,
      from: dates.value.from,
      to: dates.value.to,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      page: page.value,
      size: pageSize.value
    })
    if (seq !== logSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
  } catch (err) {
    if (seq === logSeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === logSeq) loadingLog.value = false
  }
}

function refreshAll() {
  loadSummary()
  loadLog()
}

watch(range, () => {
  page.value = 1
  refreshAll()
})
watch([() => ({ ...logFilter }), sort, pageSize], () => {
  if (page.value !== 1) page.value = 1
  else loadLog()
})
watch(page, loadLog)

onMounted(refreshAll)
</script>
