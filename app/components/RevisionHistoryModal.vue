<template>
  <UModal
    v-model:open="open"
    title="Version history"
    :description="`Every save keeps a copy (the last 50). Compare any two, and bring an old one back.`"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" class="mb-3" />
      <div v-if="loading && !revisions.length" class="py-10 text-center text-sm text-gray-500">Loading history…</div>
      <EmptyState
        v-else-if="!revisions.length"
        icon="i-lucide-history"
        title="No history yet"
        description="A copy is kept each time this is saved from now on."
        class="py-8"
      />

      <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Revisions -->
        <ol class="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
          <li v-for="r in revisions" :key="r.id">
            <button
              type="button"
              class="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors"
              :class="r.id === selectedId ? 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
              @click="selectedId = r.id"
            >
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">#{{ r.number }}</span>
                <UBadge v-if="r.id === latest?.id" size="sm" color="success" variant="subtle">Current</UBadge>
                <span class="ml-auto text-xs text-gray-400 tabular-nums">{{ r.itemCount }} {{ itemNoun }}</span>
              </div>
              <div class="text-gray-700 dark:text-gray-200 truncate">{{ r.summary }}</div>
              <div class="text-xs text-gray-500" :title="formatDateTime(r.createdAt)">
                {{ r.createdBy ?? 'system' }} · {{ formatRelativeTime(r.createdAt) }}
              </div>
            </button>
          </li>
        </ol>

        <!-- Comparison -->
        <div class="md:col-span-2 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span class="text-sm text-gray-600 dark:text-gray-300">Compare #{{ selected?.number }} with</span>
            <USelect v-model="compareTo" :items="compareOptions" size="sm" class="w-52" />
            <USwitch v-model="showUnchanged" size="xs" label="Show unchanged" class="ml-auto" />
          </div>

          <div v-if="comparing" class="py-8 text-center text-sm text-gray-500">Comparing…</div>
          <template v-else-if="rows">
            <div class="flex flex-wrap gap-2 mb-2 text-xs">
              <UBadge color="success" variant="subtle">+{{ summary.added }} added</UBadge>
              <UBadge color="error" variant="subtle">−{{ summary.removed }} removed</UBadge>
              <UBadge color="warning" variant="subtle">{{ summary.changed }} changed</UBadge>
              <UBadge color="neutral" variant="subtle">{{ summary.unchanged }} unchanged</UBadge>
            </div>
            <p v-if="!shownRows.length" class="py-6 text-center text-sm text-gray-500">No differences.</p>
            <ol
              v-else
              class="max-h-[52vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 text-sm"
            >
              <li v-for="(row, k) in shownRows" :key="k" class="px-3 py-1.5" :class="ROW_CLASS[row.type]">
                <template v-if="row.type === 'changed'">
                  <div class="flex gap-2 line-through decoration-error-400/70 text-gray-500">
                    <span class="shrink-0 w-40 font-mono text-[11px] pt-0.5">{{ span(row.before) }}</span>
                    <span class="whitespace-pre-line">{{ row.before.text }}</span>
                  </div>
                  <div class="flex gap-2 text-gray-900 dark:text-white">
                    <span class="shrink-0 w-40 font-mono text-[11px] pt-0.5">{{ span(row.after) }}</span>
                    <span class="whitespace-pre-line">{{ row.after.text }}</span>
                  </div>
                </template>
                <div v-else class="flex gap-2">
                  <span class="shrink-0 w-4 font-mono text-gray-400">{{ row.type === 'added' ? '+' : row.type === 'removed' ? '−' : '' }}</span>
                  <span class="shrink-0 w-36 font-mono text-[11px] pt-0.5 text-gray-500">{{ span(row.type === 'added' ? row.after : row.before) }}</span>
                  <span class="whitespace-pre-line" :class="row.type === 'removed' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'">
                    {{ (row.type === 'added' ? row.after : row.before).text }}
                  </span>
                </div>
              </li>
            </ol>
            <p class="mt-2 text-xs text-gray-500">Showing what changed going from #{{ olderNumber }} to #{{ newerNumber }}.</p>
          </template>

          <div v-if="canRestore && selected && selected.id !== latest?.id" class="flex justify-end mt-4">
            <UButton icon="i-lucide-undo-2" :loading="restoring" @click="onRestore">Restore #{{ selected.number }}</UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { DiffRow, TimedLine } from '#shared/utils/revisionDiff'
import type { RevisionDetail, RevisionResource, RevisionSummary } from '~/composables/useRevisions'

const props = defineProps<{
  resource: RevisionResource
  entityId: number
  /** Current version, so a restore can't overwrite edits made in the meantime. */
  version?: number
  canRestore?: boolean
}>()
// The restored record (a Subtitle or Transcript, per `resource`).
const emit = defineEmits<{ restored: [unknown] }>()
const open = defineModel<boolean>('open', { default: false })

const revisionsApi = useRevisions<{ cues?: TimedLine[] | null; segments?: TimedLine[] | null }>(props.resource)
const toast = useToast()
const itemNoun = computed(() => (props.resource === 'subtitles' ? 'cues' : 'segments'))

const revisions = ref<RevisionSummary[]>([])
const loading = ref(false)
const error = ref('')
const selectedId = ref<number | null>(null)
const compareTo = ref<'current' | 'previous'>('current')
const showUnchanged = ref(false)

const latest = computed(() => revisions.value[0] ?? null)
const selected = computed(() => revisions.value.find((r) => r.id === selectedId.value) ?? null)
const previous = computed(() => {
  const i = revisions.value.findIndex((r) => r.id === selectedId.value)
  return i >= 0 ? (revisions.value[i + 1] ?? null) : null
})
const compareOptions = computed(() => [
  { label: 'the current version', value: 'current' as const, disabled: selected.value?.id === latest.value?.id },
  { label: 'the revision before it', value: 'previous' as const, disabled: !previous.value }
])
// Always shown oldest → newest.
const pair = computed<[RevisionSummary, RevisionSummary] | null>(() => {
  const s = selected.value
  if (!s) return null
  const other = compareTo.value === 'current' && s.id !== latest.value?.id ? latest.value : previous.value
  if (!other) return null
  return other.number < s.number ? [other, s] : [s, other]
})
const olderNumber = computed(() => pair.value?.[0].number)
const newerNumber = computed(() => pair.value?.[1].number)

async function load() {
  loading.value = true
  error.value = ''
  try {
    revisions.value = await revisionsApi.history(props.entityId)
    // Start on the version before the current one: "what did the last save change?"
    selectedId.value = revisions.value[1]?.id ?? revisions.value[0]?.id ?? null
    compareTo.value = revisions.value.length > 1 ? 'current' : 'previous'
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// Snapshots are fetched on demand and cached for the modal's lifetime.
const details = new Map<number, RevisionDetail<{ cues?: TimedLine[] | null; segments?: TimedLine[] | null }>>()
async function detail(id: number) {
  if (!details.has(id)) details.set(id, await revisionsApi.get(props.entityId, id))
  return details.get(id)!
}
const lines = (d: RevisionDetail<{ cues?: TimedLine[] | null; segments?: TimedLine[] | null }>) => d.snapshot.cues ?? d.snapshot.segments ?? []

const rows = ref<DiffRow[] | null>(null)
const comparing = ref(false)
watch(
  pair,
  async (p) => {
    rows.value = null
    if (!p) return
    comparing.value = true
    try {
      const [older, newer] = await Promise.all([detail(p[0].id), detail(p[1].id)])
      if (pair.value === p) rows.value = diffTimedLines(lines(older), lines(newer))
    } catch (err) {
      error.value = apiErrorMessage(err)
    } finally {
      comparing.value = false
    }
  },
  { immediate: true }
)
watch(selectedId, () => {
  if (compareTo.value === 'current' && selected.value?.id === latest.value?.id) compareTo.value = 'previous'
})

const summary = computed(() => summarizeDiff(rows.value ?? []))
const shownRows = computed(() => (rows.value ?? []).filter((r) => showUnchanged.value || r.type !== 'same'))
const ROW_CLASS: Record<DiffRow['type'], string> = {
  same: '',
  added: 'bg-success-50/70 dark:bg-success-950/30',
  removed: 'bg-error-50/70 dark:bg-error-950/30',
  changed: 'bg-warning-50/60 dark:bg-warning-950/20'
}
const span = (l: TimedLine) => `${formatTimestamp(l.startMs)} → ${formatTimestamp(l.endMs)}`

const restoring = ref(false)
async function onRestore() {
  const s = selected.value
  if (!s) return
  restoring.value = true
  try {
    const restored = await revisionsApi.restore<unknown>(props.entityId, s.id, props.version)
    toast.add({ title: `Restored #${s.number}`, description: 'Saved as a new version — you can undo it the same way.', color: 'success' })
    emit('restored', restored)
    open.value = false
  } catch (err) {
    toast.add({ title: 'Could not restore', description: apiErrorMessage(err), color: 'error' })
  } finally {
    restoring.value = false
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    details.clear()
    load()
  }
})
</script>
