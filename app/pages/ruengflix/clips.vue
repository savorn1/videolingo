<template>
  <div>
    <PageHeader
      title="Shared clips"
      description="15-second moments viewers cut from episodes and shared (RuengFlix player › ⋯ › Share a clip). Take one down if it shouldn't be out there."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Shared clips' }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #seriesTitle-data="{ row }">
          <div class="flex items-center gap-3 min-w-0">
            <video
              v-if="row.url"
              :src="row.url"
              :poster="row.posterUrl ?? undefined"
              muted
              preload="none"
              controls
              class="w-28 aspect-video rounded bg-black shrink-0"
            />
            <div class="min-w-0">
              <NuxtLink :to="`/ruengflix/${row.seriesId}`" class="font-medium text-highlighted hover:underline">{{ row.seriesTitle }}</NuxtLink>
              <p class="text-xs text-muted">ep. {{ row.episode }} · {{ playerTime(row.startSeconds) }}–{{ playerTime(row.startSeconds + row.seconds) }}</p>
            </div>
          </div>
        </template>
        <template #status-data="{ row }">
          <UBadge :color="row.status === 'READY' ? 'success' : row.status === 'FAILED' ? 'error' : 'info'" variant="subtle" :title="row.error ?? undefined">
            {{ row.status === 'READY' ? 'Ready' : row.status === 'FAILED' ? 'Failed' : 'Cutting…' }}
          </UBadge>
        </template>
        <template #viewerName-data="{ row }">
          <span v-if="row.viewerName">{{ row.viewerName }}</span>
          <span v-else class="text-muted">Visitor</span>
        </template>
        <template #actions-data="{ row }">
          <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :loading="busyId === row.id" @click="remove(row)"
            >Take down</UButton
          >
        </template>
        <template #empty-state>
          <EmptyState icon="i-lucide-clapperboard" title="No clips yet" description="Viewers share clips from the player's ⋯ menu." />
        </template>
      </DataTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { StreamingClip } from '~/composables/useStreaming'
import { playerTime } from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingClip[]>([])
const loading = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)

const columns: ColumnDef<StreamingClip>[] = [
  { key: 'seriesTitle', label: 'Clip', value: (r) => `${r.seriesTitle} · ep. ${r.episode}` },
  { key: 'status' },
  { key: 'views' },
  { key: 'viewerName', label: 'Shared by' },
  { key: 'createdAt', label: 'Shared', type: 'datetime' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await streaming.clips()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function remove(row: StreamingClip) {
  if (!window.confirm('Take this clip down? Its link stops working and the file is deleted.')) return
  busyId.value = row.id
  try {
    await streaming.deleteClip(row.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not take it down', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}
</script>
