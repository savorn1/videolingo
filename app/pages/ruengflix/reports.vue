<template>
  <div>
    <PageHeader
      title="Problem reports"
      description="What viewers flagged from RuengFlix's player (⋯ › Report a problem), with the second they were at."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Problem reports' }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <UTabs v-model="show" :items="showItems" :content="false" size="sm" />
        <USelectMenu
          v-model="seriesFilter"
          :items="seriesOptions"
          value-key="value"
          placeholder="All series"
          :search-input="{ placeholder: 'Search series…' }"
          aria-label="Series"
          class="w-64"
        />
        <UButton v-if="seriesFilter != null" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="seriesFilter = undefined">Clear</UButton>
      </div>

      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable exportable export-filename="ruengflix-reports" @refresh="load">
        <template #seriesTitle-data="{ row }">
          <NuxtLink :to="`/ruengflix/${row.seriesId}`" class="hover:underline">{{ row.seriesTitle }}</NuxtLink>
          <span class="text-muted"> · ep. {{ row.episode }}</span>
        </template>
        <template #reason-data="{ row }">
          <UBadge color="neutral" variant="subtle">{{ REPORT_REASON_LABELS[row.reason as ReportReason] ?? row.reason }}</UBadge>
        </template>
        <template #note-data="{ row }">
          <span v-if="row.note" class="whitespace-pre-wrap">{{ row.note }}</span>
          <span v-else class="text-muted">—</span>
        </template>
        <template #positionSeconds-data="{ row }">
          <UButton
            v-if="siteUrl"
            :to="`${ruengflixUrl(siteUrl, row.seriesId, row.episode)}?t=${row.positionSeconds}`"
            target="_blank"
            size="xs"
            color="neutral"
            variant="link"
            icon="i-lucide-play"
            :title="'Watch this moment on RuengFlix'"
            >{{ playerTime(row.positionSeconds) }}</UButton
          >
          <span v-else>{{ playerTime(row.positionSeconds) }}</span>
        </template>
        <template #status-data="{ row }">
          <UBadge v-if="row.resolvedAt" color="success" variant="subtle" :title="`${formatDateTime(row.resolvedAt)}`">
            Resolved{{ row.resolvedBy ? ` by ${row.resolvedBy}` : '' }}
          </UBadge>
          <UBadge v-else color="warning" variant="subtle">Open</UBadge>
        </template>
        <template #actions-data="{ row }">
          <template v-if="canWrite">
            <UButton v-if="!row.resolvedAt" size="xs" variant="soft" icon="i-lucide-check" :loading="busyId === row.id" @click="setResolved(row, true)"
              >Resolve</UButton
            >
            <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :loading="busyId === row.id" @click="setResolved(row, false)"
              >Reopen</UButton
            >
          </template>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-flag"
            :title="show === 'open' ? 'No open reports' : 'No reports'"
            description="Viewers report problems from the player's ⋯ menu."
          />
        </template>
      </DataTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { ReportReason, ViewerReport } from '~/composables/useStreaming'
import { REPORT_REASON_LABELS, playerTime, ruengflixUrl } from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const streaming = useStreaming()
const { can } = useAuth()
const { doneWithUndo } = useUndoToast()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<ViewerReport[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)
const siteUrl = ref('')
const seriesOptions = ref<{ label: string; value: number }[]>([])

const showItems = [
  { label: 'Open', value: 'open' },
  { label: 'All', value: 'all' }
]
const show = ref<'open' | 'all'>('open')
const seriesFilter = ref<number | undefined>(route.query.series ? Number(route.query.series) : undefined)

const columns: ColumnDef<ViewerReport>[] = [
  { key: 'createdAt', label: 'Reported', type: 'datetime' },
  { key: 'seriesTitle', label: 'Series', value: (r) => `${r.seriesTitle} · ep. ${r.episode}` },
  { key: 'reason', value: (r) => REPORT_REASON_LABELS[r.reason] ?? r.reason },
  { key: 'note' },
  { key: 'positionSeconds', label: 'At', value: (r) => playerTime(r.positionSeconds) },
  { key: 'status', value: (r) => (r.resolvedAt ? 'Resolved' : 'Open') },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await streaming.reports({ includeResolved: show.value === 'all', seriesId: seriesFilter.value })
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadSeries() {
  try {
    const o = await streaming.overview()
    siteUrl.value = o.siteUrl
    seriesOptions.value = o.series.map((s) => ({ label: s.title, value: s.id }))
  } catch {
    // the filter just stays empty
  }
}

async function setResolved(row: ViewerReport, resolved: boolean) {
  busyId.value = row.id
  try {
    await streaming.resolveReport(row.id, resolved)
    await load()
    doneWithUndo(resolved ? 'Report resolved' : 'Report reopened', {
      run: () => streaming.resolveReport(row.id, !resolved),
      undone: resolved ? 'Report reopened' : 'Report resolved again',
      failed: 'Could not undo',
      after: load
    })
  } catch (err) {
    toast.add({ title: 'Could not update the report', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

watch([show, seriesFilter], () => {
  router.replace({ query: seriesFilter.value != null ? { series: String(seriesFilter.value) } : {} })
  load()
})

onMounted(() => {
  load()
  loadSeries()
})
</script>
