<template>
  <div>
    <PageHeader
      :title="transcript?.videoTitle ?? 'Transcript'"
      :description="headerDescription"
      :crumbs="[{ label: 'Transcripts', to: '/transcripts' }, { label: transcript ? `#${transcript.id}` : '…' }]"
    >
      <template v-if="transcript && !editing" #actions>
        <UButton color="primary" variant="soft" icon="i-lucide-pencil" :disabled="regenerating" @click="startEditing">Edit</UButton>
        <UDropdownMenu :items="exportItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="soft" icon="i-lucide-download" trailing-icon="i-lucide-chevron-down" :disabled="!transcript.segmentCount"
            >Export</UButton
          >
        </UDropdownMenu>
        <UButton color="neutral" variant="soft" icon="i-lucide-history" @click="showHistory = true">History</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-refresh-cw" :disabled="regenerating" @click="confirmRegenerate = true">Regenerate</UButton>
        <UButton color="error" variant="soft" icon="i-lucide-trash-2" :disabled="regenerating" @click="confirmDelete = true">Delete</UButton>
      </template>
      <template v-else-if="transcript && editing" #actions>
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="cancelEditing">Cancel</UButton>
        <UButton icon="i-lucide-save" :loading="saving" :disabled="!isDirty || invalidCount > 0" @click="save">Save</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/transcripts">Back to transcripts</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !transcript" :fields="4" />

    <template v-else-if="transcript">
      <!-- Regeneration in progress / just failed -->
      <UCard v-if="job && (regenerating || job.status === 'FAILED')" class="mb-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2">
            <UIcon
              :name="regenerating ? 'i-lucide-refresh-cw' : 'i-lucide-circle-x'"
              class="w-4 h-4"
              :class="regenerating ? 'text-info-500 animate-spin' : 'text-error-500'"
            />
            <span class="font-semibold text-gray-900 dark:text-white">{{ regenerating ? 'Regenerating this transcript' : 'Last regeneration failed' }}</span>
            <StatusBadge :status="job.status" />
          </div>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-cpu" :to="`/processing-jobs/${job.id}`">Job #{{ job.id }}</UButton>
        </div>
        <JobProgress :status="job.status" :progress="job.progress" :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep" size="lg" />
        <p v-if="regenerating" class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Editing is paused — the segments below are replaced when the job finishes.
        </p>
      </UCard>

      <UAlert v-if="conflict" color="warning" variant="subtle" class="mb-4" icon="i-lucide-git-compare" :title="conflict">
        <template #actions>
          <UButton size="xs" color="warning" variant="soft" icon="i-lucide-rotate-ccw" @click="discardAndReload">Discard my edits and reload</UButton>
        </template>
      </UAlert>

      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <!-- Player + facts -->
        <div class="xl:col-span-2 space-y-4 xl:sticky xl:top-4">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="relative aspect-video bg-black rounded-t-lg overflow-hidden">
              <video
                v-if="transcript.videoUrl && !playbackError"
                ref="player"
                :src="transcript.videoUrl"
                controls
                preload="metadata"
                class="w-full h-full"
                @timeupdate="onTimeUpdate"
                @error="playbackError = true"
              />
              <div v-else class="absolute inset-0 flex items-center justify-center text-sm text-white/60">No playable video</div>
            </div>
            <!-- Caption preview: the segment being spoken right now. -->
            <div class="min-h-12 px-4 py-3 text-sm text-center text-gray-900 dark:text-white border-t border-gray-100 dark:border-gray-800">
              <template v-if="activeSegmentText">{{ activeSegmentText }}</template>
              <span v-else class="text-gray-400">{{ formatTimestamp(currentMs) }}</span>
            </div>
          </UCard>

          <UCard>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div v-for="item in facts" :key="item.label">
                <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
                <dd class="font-semibold text-gray-900 dark:text-white tabular-nums truncate" :title="item.title">
                  <NuxtLink v-if="item.to" :to="item.to" class="text-primary-600 dark:text-primary-400 hover:underline">{{ item.value }}</NuxtLink>
                  <template v-else>{{ item.value }}</template>
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <!-- Segments -->
        <UCard class="xl:col-span-3" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Segments</h2>
                <UBadge color="neutral" variant="subtle" size="sm">{{ (editing ? draft.length : segments.length).toLocaleString() }}</UBadge>
                <UBadge v-if="editing && invalidCount" color="error" variant="subtle" size="sm">{{ invalidCount }} to fix</UBadge>
              </div>
              <div class="flex items-center gap-2">
                <USelect
                  v-if="editing"
                  v-model="draftLanguage"
                  :items="languageOptions(draftLanguage)"
                  size="sm"
                  class="w-36"
                  aria-label="Transcript language"
                />
                <!-- Search within this transcript -->
                <UInput v-model="find" size="sm" placeholder="Find in transcript" icon="i-lucide-search" class="w-48" @keydown.enter.prevent="gotoMatch(1)" />
                <template v-if="find.trim()">
                  <span class="text-xs text-gray-500 tabular-nums whitespace-nowrap">{{
                    matches.length ? `${matchCursor + 1} / ${matches.length}` : '0 found'
                  }}</span>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-chevron-up"
                    aria-label="Previous match"
                    :disabled="!matches.length"
                    @click="gotoMatch(-1)"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-chevron-down"
                    aria-label="Next match"
                    :disabled="!matches.length"
                    @click="gotoMatch(1)"
                  />
                </template>
              </div>
            </div>
          </template>

          <div ref="segmentList" class="max-h-[70vh] overflow-y-auto">
            <!-- View mode -->
            <template v-if="!editing">
              <EmptyState
                v-if="!segments.length"
                icon="i-lucide-captions-off"
                title="This transcript is empty"
                description="Add segments with Edit, or Regenerate to have it transcribed."
                class="py-10"
              />
              <ol v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="(seg, i) in segments"
                  :id="`seg-${i}`"
                  :key="seg.id ?? i"
                  class="flex gap-3 px-4 py-2.5 transition-colors"
                  :class="[
                    i === activeIndex ? 'bg-primary-50 dark:bg-primary-950/40' : '',
                    matches[matchCursor] === i ? 'ring-2 ring-inset ring-yellow-400' : ''
                  ]"
                >
                  <button
                    type="button"
                    class="shrink-0 w-20 text-left font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline pt-0.5 tabular-nums"
                    :title="`Play from ${formatTimestamp(seg.startMs)}`"
                    @click="seek(seg.startMs, true)"
                  >
                    {{ formatTimestamp(seg.startMs) }}
                  </button>
                  <div class="min-w-0 flex-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">
                    <span v-if="seg.speaker" class="font-semibold text-gray-500 dark:text-gray-400">{{ seg.speaker }}: </span>
                    <template v-for="(part, p) in splitHighlight(seg.text, find)" :key="p">
                      <mark v-if="part.match" class="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5">{{ part.text }}</mark>
                      <template v-else>{{ part.text }}</template>
                    </template>
                  </div>
                </li>
              </ol>
            </template>

            <!-- Edit mode -->
            <template v-else>
              <ol class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="(row, i) in draft"
                  :id="`seg-${i}`"
                  :key="row.key"
                  class="px-4 py-3 space-y-2"
                  :class="[rowErrors[i] ? 'bg-error-50/60 dark:bg-error-950/30' : '', matches[matchCursor] === i ? 'ring-2 ring-inset ring-yellow-400' : '']"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="w-6 text-xs text-gray-400 tabular-nums">{{ i + 1 }}</span>
                    <UInput v-model="row.start" size="xs" class="w-28 font-mono" aria-label="Start time" placeholder="0:00.000">
                      <template #trailing>
                        <UTooltip text="Set to player time">
                          <UButton
                            size="xs"
                            color="neutral"
                            variant="link"
                            icon="i-lucide-timer"
                            :padded="false"
                            aria-label="Set start to player time"
                            @click="row.start = formatTimestamp(currentMs)"
                          />
                        </UTooltip>
                      </template>
                    </UInput>
                    <span class="text-gray-400">→</span>
                    <UInput v-model="row.end" size="xs" class="w-28 font-mono" aria-label="End time" placeholder="0:02.000">
                      <template #trailing>
                        <UTooltip text="Set to player time">
                          <UButton
                            size="xs"
                            color="neutral"
                            variant="link"
                            icon="i-lucide-timer"
                            :padded="false"
                            aria-label="Set end to player time"
                            @click="row.end = formatTimestamp(currentMs)"
                          />
                        </UTooltip>
                      </template>
                    </UInput>
                    <UInput v-model="row.speaker" size="xs" class="w-28" placeholder="Speaker" aria-label="Speaker" />
                    <div class="ml-auto flex items-center gap-1">
                      <UTooltip text="Play from here">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-play"
                          aria-label="Play from here"
                          :disabled="parseTimestamp(row.start) === null"
                          @click="seek(parseTimestamp(row.start) ?? 0, true)"
                        />
                      </UTooltip>
                      <UTooltip text="Insert a segment below">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          icon="i-lucide-between-horizontal-end"
                          aria-label="Insert below"
                          @click="insertAfter(i)"
                        />
                      </UTooltip>
                      <UTooltip text="Remove">
                        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove segment" @click="draft.splice(i, 1)" />
                      </UTooltip>
                    </div>
                  </div>
                  <UTextarea v-model="row.text" :rows="1" autoresize :maxrows="6" class="w-full" aria-label="Segment text" />
                  <p v-if="rowErrors[i]" class="text-xs text-error-600 dark:text-error-400">{{ rowErrors[i] }}</p>
                </li>
              </ol>
              <div class="px-4 py-3">
                <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-plus" @click="insertAfter(draft.length - 1)">Add segment</UButton>
              </div>
            </template>
          </div>
        </UCard>
      </div>
    </template>

    <RevisionHistoryModal
      v-if="transcript"
      v-model:open="showHistory"
      resource="transcripts"
      :entity-id="transcript.id"
      :version="transcript.version"
      :can-restore="can('transcripts', 'WRITE') && !regenerating"
      @restored="(t) => (transcript = t as Transcript)"
    />

    <ConfirmModal
      v-model="confirmRegenerate"
      title="Regenerate transcript"
      :description="regenerateDescription"
      confirm-label="Regenerate"
      :loading="busy"
      @confirm="onRegenerate"
    />
    <ConfirmModal
      v-model="confirmDelete"
      title="Delete transcript"
      :description="`Delete this ${languageLabel(transcript?.language)} transcript (${transcript?.segmentCount ?? 0} segments)? This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ProcessingJobProgress } from '~/composables/useProcessingJobs'
import { EXPORT_FORMATS, TRANSCRIPT_SOURCES, type Transcript, type TranscriptSegment } from '~/composables/useTranscripts'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { get, update, remove, regenerate, exportFile } = useTranscripts()
const { progress: jobProgress } = useProcessingJobs()
const { can } = useAuth()
const showHistory = ref(false)

const id = computed(() => Number(route.params.id))
const transcript = ref<Transcript | null>(null)
const loading = ref(false)
const error = ref('')

const segments = computed<TranscriptSegment[]>(() => transcript.value?.segments ?? [])

async function load() {
  loading.value = true
  error.value = ''
  try {
    transcript.value = await get(id.value)
    job.value = transcript.value.lastJobId
      ? {
          id: transcript.value.lastJobId,
          status: transcript.value.lastJobStatus!,
          progress: transcript.value.lastJobProgress ?? 0,
          currentStep: null,
          errorMessage: null,
          durationSeconds: null,
          updatedAt: null,
          lastLogId: null
        }
      : null
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const isTranslation = computed(() => !!transcript.value?.videoLanguage && transcript.value.language !== transcript.value.videoLanguage)
const headerDescription = computed(() => {
  const t = transcript.value
  if (!t) return undefined
  const source = TRANSCRIPT_SOURCES.find((s) => s.value === t.source)?.label ?? t.source
  return `${languageLabel(t.language)} ${isTranslation.value ? 'translation' : 'transcript'} · ${source}`
})

const facts = computed(() => {
  const t = transcript.value
  if (!t) return []
  return [
    { label: 'Video', value: t.videoTitle ?? `#${t.videoId}`, to: `/videos/${t.videoId}`, title: t.videoTitle ?? undefined },
    { label: 'Language', value: `${languageLabel(t.language)}${isTranslation.value ? ` (from ${languageLabel(t.videoLanguage)})` : ''}` },
    { label: 'Segments', value: t.segmentCount.toLocaleString() },
    { label: 'Words', value: t.wordCount.toLocaleString() },
    { label: 'Length', value: formatDuration(t.durationMs / 1000) },
    { label: 'Video length', value: formatDuration(t.videoDurationSeconds) },
    {
      label: 'Updated',
      value: t.updatedAt ? formatRelativeTime(t.updatedAt) : '—',
      title: `${formatDateTime(t.updatedAt)}${t.updatedBy ? ` by ${t.updatedBy}` : ''}`
    },
    { label: 'Created', value: formatDate(t.createdAt), title: `${formatDateTime(t.createdAt)}${t.createdBy ? ` by ${t.createdBy}` : ''}` }
  ] as { label: string; value: string; to?: string; title?: string }[]
})

// ── Player sync ────────────────────────────────────────────────────────────
const player = ref<HTMLVideoElement | null>(null)
const playbackError = ref(false)
const currentMs = ref(0)
const segmentList = ref<HTMLElement | null>(null)

function onTimeUpdate() {
  if (player.value) currentMs.value = Math.round(player.value.currentTime * 1000)
}

// The segment being spoken now: the last one that has started and not ended.
const activeIndex = computed(() => {
  const list = segments.value
  let found = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i]!.startMs > currentMs.value) break
    if (currentMs.value < list[i]!.endMs) found = i
  }
  return found
})
const activeSegmentText = computed(() => (activeIndex.value >= 0 ? segments.value[activeIndex.value]!.text : ''))

// While playing, keep the spoken line in view (view mode only — in edit mode
// the list must stay where the person is typing).
watch(activeIndex, (i) => {
  if (i < 0 || editing.value || !player.value || player.value.paused) return
  scrollToSegment(i)
})

function seek(ms: number, play = false) {
  currentMs.value = ms
  if (!player.value) return
  player.value.currentTime = ms / 1000
  if (play) player.value.play().catch(() => {})
}

function scrollToSegment(index: number) {
  nextTick(() => document.getElementById(`seg-${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
}

// ── Find in transcript ─────────────────────────────────────────────────────
const find = ref(typeof route.query.q === 'string' ? route.query.q : '')
const matchCursor = ref(0)
const matches = computed(() => {
  const term = find.value.trim().toLowerCase()
  if (!term) return []
  const texts = editing.value ? draft.value.map((r) => r.text) : segments.value.map((s) => s.text)
  return texts.flatMap((text, i) => (text.toLowerCase().includes(term) ? [i] : []))
})
watch(find, () => {
  matchCursor.value = 0
  if (matches.value.length) scrollToSegment(matches.value[0]!)
})
function gotoMatch(step: number) {
  if (!matches.value.length) return
  matchCursor.value = (matchCursor.value + step + matches.value.length) % matches.value.length
  scrollToSegment(matches.value[matchCursor.value]!)
}

// ── Export ─────────────────────────────────────────────────────────────────
const exportItems = computed<DropdownMenuItem[][]>(() => [
  EXPORT_FORMATS.map((f) => ({
    label: f.label,
    description: f.description,
    icon: 'i-lucide-file-down',
    onSelect: () => onExport(f.value)
  }))
])

async function onExport(format: (typeof EXPORT_FORMATS)[number]['value']) {
  if (!transcript.value) return
  try {
    const name = await exportFile(transcript.value.id, format)
    toast.add({ title: `Downloaded ${name}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Export failed', description: apiErrorMessage(err), color: 'error' })
  }
}

// ── Editing ────────────────────────────────────────────────────────────────
interface DraftRow {
  key: number
  start: string
  end: string
  speaker: string
  text: string
}
let nextKey = 0
const editing = ref(false)
const saving = ref(false)
const conflict = ref('')
const draft = ref<DraftRow[]>([])
const draftLanguage = ref('')
// Snapshot of the draft as loaded, to tell whether anything changed.
let pristine = ''

function toRow(seg: TranscriptSegment): DraftRow {
  return { key: nextKey++, start: formatTimestamp(seg.startMs), end: formatTimestamp(seg.endMs), speaker: seg.speaker ?? '', text: seg.text }
}
function snapshot() {
  return JSON.stringify({ language: draftLanguage.value, rows: draft.value.map(({ start, end, speaker, text }) => [start, end, speaker.trim(), text.trim()]) })
}

function startEditing() {
  if (!transcript.value) return
  draft.value = segments.value.map(toRow)
  draftLanguage.value = transcript.value.language
  pristine = snapshot()
  conflict.value = ''
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  conflict.value = ''
  draft.value = []
  // Drop ?edit=1 so a refresh doesn't reopen the editor.
  if (route.query.edit) router.replace({ query: { ...route.query, edit: undefined } })
}

const isDirty = computed(() => editing.value && snapshot() !== pristine)
useUnsavedChangesGuard(isDirty)

const rowErrors = computed(() => draft.value.map((row) => segmentError({ startMs: parseTimestamp(row.start), endMs: parseTimestamp(row.end), text: row.text })))
const invalidCount = computed(() => rowErrors.value.filter(Boolean).length)

// New row starts where the previous one ends (or at the player's position
// for the very first row), two seconds long.
function insertAfter(index: number) {
  const prevEnd = index >= 0 ? parseTimestamp(draft.value[index]!.end) : null
  const start = prevEnd ?? currentMs.value
  draft.value.splice(index + 1, 0, { key: nextKey++, start: formatTimestamp(start), end: formatTimestamp(start + 2000), speaker: '', text: '' })
  nextTick(() => {
    scrollToSegment(index + 1)
    document.querySelector<HTMLTextAreaElement>(`#seg-${index + 1} textarea`)?.focus()
  })
}

async function save() {
  if (!transcript.value || invalidCount.value) return
  saving.value = true
  conflict.value = ''
  try {
    const saved = await update(transcript.value.id, {
      version: transcript.value.version,
      language: draftLanguage.value,
      segments: draft.value.map((row) => ({
        startMs: parseTimestamp(row.start)!,
        endMs: parseTimestamp(row.end)!,
        text: row.text.trim(),
        speaker: row.speaker.trim() || null
      }))
    })
    transcript.value = saved
    editing.value = false
    draft.value = []
    if (route.query.edit) router.replace({ query: { ...route.query, edit: undefined } })
    toast.add({ title: 'Transcript saved', description: `${saved.segmentCount} segments · ${saved.wordCount} words`, color: 'success' })
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 409) conflict.value = apiErrorMessage(err)
    else toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function discardAndReload() {
  editing.value = false
  draft.value = []
  conflict.value = ''
  await load()
}

// ── Regenerate (and follow the job) ────────────────────────────────────────
const job = ref<ProcessingJobProgress | null>(null)
const regenerating = computed(() => !!job.value && isActiveJobStatus(job.value.status))
const confirmRegenerate = ref(false)
const busy = ref(false)

const regenerateDescription = computed(() => {
  const t = transcript.value
  if (!t) return ''
  const how = isTranslation.value ? `translated again from the ${languageLabel(t.videoLanguage)} transcript` : `transcribed again from the video's audio`
  return `This transcript will be ${how}. When the job finishes, its ${t.segmentCount} current segment(s) are replaced — including any manual edits.`
})

async function onRegenerate() {
  if (!transcript.value) return
  busy.value = true
  try {
    const queued = await regenerate(transcript.value.id)
    job.value = {
      id: queued.id,
      status: queued.status,
      progress: queued.progress,
      currentStep: queued.currentStep,
      errorMessage: null,
      durationSeconds: null,
      updatedAt: queued.updatedAt,
      lastLogId: null
    }
    confirmRegenerate.value = false
    toast.add({ title: `Regeneration queued — job #${queued.id}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not regenerate', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

const POLL_MS = 3000
let pollTimer: ReturnType<typeof setInterval> | undefined
async function pollJob() {
  if (!job.value || !regenerating.value || document.visibilityState !== 'visible') return
  try {
    const p = await jobProgress(job.value.id)
    const wasActive = regenerating.value
    job.value = p
    if (wasActive && p.status === 'SUCCEEDED') {
      toast.add({ title: 'Transcript regenerated', color: 'success' })
      await load()
    }
  } catch {
    // transient — next tick retries
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
const confirmDelete = ref(false)
async function onDelete() {
  if (!transcript.value) return
  busy.value = true
  try {
    await remove(transcript.value.id)
    toast.add({ title: 'Transcript deleted', color: 'success' })
    confirmDelete.value = false
    await navigateTo('/transcripts')
  } catch (err) {
    toast.add({ title: 'Could not delete transcript', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ── Mount: honour ?t= (seek), ?q= (find), ?edit=1 ──────────────────────────
onMounted(async () => {
  await load()
  if (!transcript.value) return
  const t = Number(route.query.t)
  if (Number.isFinite(t) && t >= 0) {
    nextTick(() => seek(t))
    const index = segments.value.findIndex((s) => s.startMs === t)
    if (index >= 0) scrollToSegment(index)
  } else if (matches.value.length) {
    scrollToSegment(matches.value[0]!)
  }
  if (route.query.edit === '1' && !regenerating.value) startEditing()
  pollTimer = setInterval(pollJob, POLL_MS)
})
onBeforeUnmount(() => clearInterval(pollTimer))
</script>
