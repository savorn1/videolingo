<template>
  <div>
    <PageHeader
      :title="subtitle?.label ?? 'Subtitle track'"
      :description="headerDescription"
      :crumbs="[{ label: 'Subtitles', to: '/subtitles' }, { label: subtitle ? `#${subtitle.id}` : '…' }]"
    >
      <template v-if="subtitle && !editing" #actions>
        <UButton color="primary" variant="soft" icon="i-lucide-pencil" @click="startEditing">Edit</UButton>
        <UButton v-if="subtitle.published" color="neutral" variant="soft" icon="i-lucide-eye-off" :loading="busy" @click="togglePublished">Unpublish</UButton>
        <UButton v-else color="success" variant="soft" icon="i-lucide-eye" :loading="busy" @click="togglePublished">Publish</UButton>
        <UDropdownMenu :items="moreItems" :content="{ align: 'end' }">
          <UButton color="neutral" variant="soft" icon="i-lucide-ellipsis" aria-label="More actions" />
        </UDropdownMenu>
      </template>
      <template v-else-if="subtitle && editing" #actions>
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="cancelEditing">Cancel</UButton>
        <UButton icon="i-lucide-save" :loading="saving" :disabled="!isDirty || invalidCount > 0 || rulesInvalid" @click="save">Save</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/subtitles">Back to subtitles</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !subtitle" :fields="4" />

    <template v-else-if="subtitle">
      <UAlert v-if="conflict" color="warning" variant="subtle" class="mb-4" icon="i-lucide-git-compare" :title="conflict">
        <template #actions>
          <UButton size="xs" color="warning" variant="soft" icon="i-lucide-rotate-ccw" @click="discardAndReload">Discard my edits and reload</UButton>
        </template>
      </UAlert>

      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <!-- ── Preview ─────────────────────────────────────────────────── -->
        <div class="xl:col-span-3 space-y-4 xl:sticky xl:top-4">
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <div class="relative aspect-video bg-black rounded-t-lg overflow-hidden">
              <video
                v-if="subtitle.videoUrl && !playbackError"
                ref="player"
                :src="subtitle.videoUrl"
                controls
                preload="metadata"
                class="w-full h-full"
                @play="startClock"
                @pause="stopClock"
                @seeked="syncClock"
                @timeupdate="syncClock"
                @error="playbackError = true"
              />
              <div v-else class="absolute inset-0 flex items-center justify-center text-sm text-white/60">No playable video — the cue list still works</div>

              <!-- Subtitle overlay: second track on top (smaller, dimmer), this track at the bottom. -->
              <div
                v-if="secondaryCue"
                class="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-6"
                :style="{ fontSize: `${overlayScale * 0.8}rem` }"
              >
                <span class="rounded bg-black/60 px-2 py-0.5 text-center text-yellow-200 whitespace-pre-line leading-snug">{{ secondaryCue.text }}</span>
              </div>
              <div
                v-if="primaryCueText"
                class="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-6"
                :style="{ fontSize: `${overlayScale}rem` }"
              >
                <span class="rounded bg-black/75 px-2 py-0.5 text-center text-white whitespace-pre-line leading-snug font-semibold">{{ primaryCueText }}</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="w-4 h-4 text-gray-400" />
                <USelect v-model="secondaryId" :items="secondaryOptions" size="sm" class="w-56" aria-label="Show a second track" />
              </div>
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <span class="tabular-nums font-mono text-xs">{{ formatTimestamp(currentMs) }}</span>
                <UFieldGroup size="xs">
                  <UButton
                    v-for="s in SIZES"
                    :key="s.value"
                    :color="overlayScale === s.value ? 'primary' : 'neutral'"
                    variant="soft"
                    @click="overlayScale = s.value"
                  >
                    {{ s.label }}
                  </UButton>
                </UFieldGroup>
              </div>
            </div>
          </UCard>

          <!-- Settings (edit mode) / facts (view mode) -->
          <UCard v-if="editing">
            <template #header>
              <h2 class="font-semibold text-gray-900 dark:text-white">Track settings</h2>
            </template>
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <UFormField label="Label" required>
                  <UInput v-model="draftMeta.label" maxlength="100" class="w-full" />
                </UFormField>
                <UFormField label="Language">
                  <USelect v-model="draftMeta.language" :items="languageOptions(draftMeta.language)" class="w-full" />
                </UFormField>
                <UFormField label="Kind">
                  <USelect v-model="draftMeta.kind" :items="SUBTITLE_KINDS.map((k) => ({ label: k.label, value: k.value }))" class="w-full" />
                </UFormField>
              </div>
              <USwitch v-model="draftMeta.published" label="Published — offered to learners" />
              <UFormField label="Readability rules" description="Warnings update as you edit.">
                <SubtitleRulesFields v-model="draftMeta.rules" :language="draftMeta.language" compact />
              </UFormField>
            </div>
          </UCard>
          <UCard v-else>
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <div v-for="item in facts" :key="item.label" class="min-w-0">
                <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
                <dd class="font-semibold text-gray-900 dark:text-white tabular-nums truncate" :title="item.title ?? item.value">
                  <NuxtLink v-if="item.to" :to="item.to" class="text-primary-600 dark:text-primary-400 hover:underline">{{ item.value }}</NuxtLink>
                  <template v-else>{{ item.value }}</template>
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <!-- ── Cues ────────────────────────────────────────────────────── -->
        <UCard class="xl:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Cues</h2>
                <UBadge color="neutral" variant="subtle" size="sm">{{ (editing ? draft.length : cues.length).toLocaleString() }}</UBadge>
                <UBadge v-if="editing && invalidCount" color="error" variant="subtle" size="sm">{{ invalidCount }} to fix</UBadge>
                <UBadge v-if="liveIssues.length" color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert"
                  >{{ liveIssues.length }} warning{{ liveIssues.length === 1 ? '' : 's' }}</UBadge
                >
              </div>
              <USwitch v-if="liveIssues.length" v-model="onlyIssues" size="sm" label="Only with warnings" />
            </div>
          </template>

          <div class="max-h-[75vh] overflow-y-auto">
            <!-- View -->
            <template v-if="!editing">
              <EmptyState
                v-if="!cues.length"
                icon="i-lucide-subtitles"
                title="No cues yet"
                :description="subtitle.transcriptId ? 'Regenerate from the transcript, or add cues with Edit.' : 'Add cues with Edit.'"
                class="py-10"
              />
              <ol v-else class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="i in visibleIndexes"
                  :id="`cue-${i}`"
                  :key="i"
                  class="flex gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  :class="i === activeIndex ? 'bg-primary-50 dark:bg-primary-950/40' : ''"
                  @click="seek(cues[i]!.startMs, true)"
                >
                  <div class="shrink-0 w-24 font-mono text-[11px] leading-4 text-gray-500 tabular-nums pt-0.5">
                    <div class="text-primary-600 dark:text-primary-400">{{ formatTimestamp(cues[i]!.startMs) }}</div>
                    <div>{{ formatTimestamp(cues[i]!.endMs) }}</div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-gray-900 dark:text-white whitespace-pre-line">{{ cues[i]!.text }}</p>
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                      <span class="text-[11px] text-gray-400 tabular-nums"
                        >{{ charsPerSecond(cues[i]!.text, cues[i]!.startMs, cues[i]!.endMs).toFixed(1) }} cps</span
                      >
                      <UTooltip v-for="issue in issuesByCue.get(i) ?? []" :key="issue.type" :text="issue.message">
                        <UBadge size="sm" color="warning" variant="subtle">{{ ISSUE_LABELS[issue.type] }}</UBadge>
                      </UTooltip>
                    </div>
                  </div>
                </li>
              </ol>
            </template>

            <!-- Edit -->
            <template v-else>
              <ol class="divide-y divide-gray-100 dark:divide-gray-800">
                <li
                  v-for="i in visibleIndexes"
                  :id="`cue-${i}`"
                  :key="draft[i]!.key"
                  class="px-4 py-3 space-y-2"
                  :class="[rowErrors[i] ? 'bg-error-50/60 dark:bg-error-950/30' : '', i === activeIndex ? 'ring-2 ring-inset ring-primary-300' : '']"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="w-6 text-xs text-gray-400 tabular-nums">{{ i + 1 }}</span>
                    <UInput v-model="draft[i]!.start" size="xs" class="w-28 font-mono" aria-label="Start time">
                      <template #trailing>
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="link"
                          icon="i-lucide-timer"
                          :padded="false"
                          aria-label="Set start to player time"
                          @click="draft[i]!.start = formatTimestamp(currentMs)"
                        />
                      </template>
                    </UInput>
                    <span class="text-gray-400">→</span>
                    <UInput v-model="draft[i]!.end" size="xs" class="w-28 font-mono" aria-label="End time">
                      <template #trailing>
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="link"
                          icon="i-lucide-timer"
                          :padded="false"
                          aria-label="Set end to player time"
                          @click="draft[i]!.end = formatTimestamp(currentMs)"
                        />
                      </template>
                    </UInput>
                    <div class="ml-auto flex items-center gap-0.5">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-play"
                        aria-label="Play from here"
                        @click="seek(parseTimestamp(draft[i]!.start) ?? 0, true)"
                      />
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        icon="i-lucide-between-horizontal-end"
                        aria-label="Insert below"
                        @click="insertAfter(i)"
                      />
                      <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Remove cue" @click="draft.splice(i, 1)" />
                    </div>
                  </div>
                  <UTextarea v-model="draft[i]!.text" :rows="2" autoresize :maxrows="5" class="w-full" aria-label="Cue text (Enter for a new line)" />
                  <p v-if="rowErrors[i]" class="text-xs text-error-600 dark:text-error-400">{{ rowErrors[i] }}</p>
                  <div v-else-if="issuesByCue.get(i)?.length" class="flex flex-wrap gap-1.5">
                    <UBadge v-for="issue in issuesByCue.get(i)" :key="issue.type" size="sm" color="warning" variant="subtle">{{ issue.message }}</UBadge>
                  </div>
                </li>
              </ol>
              <div class="px-4 py-3">
                <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-plus" @click="insertAfter(draft.length - 1)">Add cue</UButton>
              </div>
            </template>
          </div>
        </UCard>
      </div>
    </template>

    <!-- Regenerate -->
    <UModal v-model:open="showRegenerate" title="Regenerate from transcript" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="subtitle?.source === 'MANUAL' || subtitle?.source === 'UPLOADED'"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`This replaces all ${subtitle?.cueCount ?? 0} current cues`"
            description="Hand edits and uploaded timing are lost. Download a copy first if you might want them back."
          />
          <UFormField label="Transcript" required>
            <USelect v-model="regenTranscriptId" :items="regenTranscriptOptions" placeholder="Choose a transcript" class="w-full" />
          </UFormField>
          <p v-if="!regenTranscriptOptions.length" class="text-sm text-gray-500 dark:text-gray-400">
            No {{ languageLabel(subtitle?.language) }} transcript with text for this video.
            <NuxtLink :to="`/transcripts?videoId=${subtitle?.videoId}`" class="text-primary-600 dark:text-primary-400 hover:underline">Create one</NuxtLink>
            first.
          </p>
          <UFormField label="Readability rules">
            <SubtitleRulesFields v-model="regenRules" :language="subtitle?.language" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showRegenerate = false">Cancel</UButton>
            <UButton
              icon="i-lucide-refresh-cw"
              :loading="busy"
              :disabled="!regenTranscriptId || regenRules.maxDurationMs <= regenRules.minDurationMs"
              @click="onRegenerate"
            >
              Regenerate
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      v-model="confirmDelete"
      title="Delete subtitle track"
      :description="`Delete '${subtitle?.label ?? ''}' (${subtitle?.cueCount ?? 0} cues)?${subtitle?.published ? ' Learners will stop seeing it immediately.' : ''} This cannot be undone.`"
      confirm-label="Delete"
      color="error"
      :loading="busy"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SubtitleIssue, SubtitleRules } from '#shared/utils/subtitleQuality'
import { SUBTITLE_KINDS, SUBTITLE_SOURCES, type Subtitle, type SubtitleCue, type SubtitleFormat, type SubtitleKind } from '~/composables/useSubtitles'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { get, list, update, setDefault, regenerate, remove, download } = useSubtitles()
const { list: listTranscripts } = useTranscripts()

const id = computed(() => Number(route.params.id))
const subtitle = ref<Subtitle | null>(null)
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const cues = computed<SubtitleCue[]>(() => subtitle.value?.cues ?? [])

async function load() {
  loading.value = true
  error.value = ''
  try {
    subtitle.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

const headerDescription = computed(() => {
  const s = subtitle.value
  if (!s) return undefined
  const kind = s.kind === 'CAPTIONS' ? 'captions' : 'subtitles'
  const state = s.published ? (s.isDefault ? 'Published · default track' : 'Published') : 'Draft'
  return `${languageLabel(s.language)} ${kind} for “${s.videoTitle ?? `video #${s.videoId}`}” · ${state}`
})

const facts = computed(() => {
  const s = subtitle.value
  if (!s) return []
  const source = SUBTITLE_SOURCES.find((x) => x.value === s.source)?.label ?? s.source
  return [
    { label: 'Video', value: s.videoTitle ?? `#${s.videoId}`, to: `/videos/${s.videoId}` },
    {
      label: 'Source',
      value: s.source === 'UPLOADED' && s.originalFilename ? `${source} (${s.originalFilename})` : s.transcriptId ? `${source} from transcript` : source,
      to: s.transcriptId ? `/transcripts/${s.transcriptId}` : undefined
    },
    { label: 'Cues', value: s.cueCount.toLocaleString() },
    { label: 'Length', value: formatDuration(s.durationMs / 1000) },
    { label: 'Rules', value: `${s.rules.maxLines} × ${s.rules.maxCharsPerLine} chars · ≤ ${s.rules.maxCps} cps` },
    { label: 'On screen', value: `${s.rules.minDurationMs / 1000}–${s.rules.maxDurationMs / 1000} s` },
    {
      label: 'Updated',
      value: s.updatedAt ? formatRelativeTime(s.updatedAt) : '—',
      title: `${formatDateTime(s.updatedAt)}${s.updatedBy ? ` by ${s.updatedBy}` : ''}`
    },
    { label: 'Created', value: formatDate(s.createdAt), title: `${formatDateTime(s.createdAt)}${s.createdBy ? ` by ${s.createdBy}` : ''}` }
  ] as { label: string; value: string; to?: string; title?: string }[]
})

// ── Editing state ──────────────────────────────────────────────────────────
// Declared before the player section on purpose: watch(activeIndex) there
// evaluates its source immediately, and that reads `editing` / `draftTimes` —
// declaring them later throws "Cannot access 'editing' before initialization".
interface DraftRow {
  key: number
  start: string
  end: string
  text: string
}
let nextKey = 0
const editing = ref(false)
const saving = ref(false)
const conflict = ref('')
const draft = ref<DraftRow[]>([])
const draftMeta = reactive<{ label: string; language: string; kind: SubtitleKind; published: boolean; rules: SubtitleRules }>({
  label: '',
  language: '',
  kind: 'SUBTITLES',
  published: false,
  rules: defaultSubtitleRules(null)
})
let pristine = ''

const draftTimes = computed(() => draft.value.map((r) => ({ startMs: parseTimestamp(r.start) ?? 0, endMs: parseTimestamp(r.end) ?? 0 })))

// ── Player clock ───────────────────────────────────────────────────────────
// timeupdate only fires ~4×/s — too coarse for subtitle timing — so while
// playing, a requestAnimationFrame loop reads currentTime every frame.
const player = ref<HTMLVideoElement | null>(null)
const playbackError = ref(false)
const currentMs = ref(0)
let frame = 0
function syncClock() {
  if (player.value) currentMs.value = Math.round(player.value.currentTime * 1000)
}
function startClock() {
  cancelAnimationFrame(frame)
  const tick = () => {
    syncClock()
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}
function stopClock() {
  cancelAnimationFrame(frame)
  syncClock()
}
onBeforeUnmount(() => cancelAnimationFrame(frame))

function seek(ms: number, play = false) {
  currentMs.value = ms
  if (!player.value) return
  player.value.currentTime = ms / 1000
  if (play) player.value.play().catch(() => {})
}

// In edit mode the overlay previews the draft, so timing tweaks show immediately.
const previewCues = computed(() =>
  editing.value
    ? draft.value
        .map((r) => ({ startMs: parseTimestamp(r.start), endMs: parseTimestamp(r.end), text: r.text }))
        .filter((c): c is { startMs: number; endMs: number; text: string } => c.startMs !== null && c.endMs !== null && c.endMs > c.startMs)
    : cues.value
)
const activeIndex = computed(() => activeCueIndex(editing.value ? draftTimes.value : cues.value, currentMs.value))
const primaryCueText = computed(() => {
  const list = [...previewCues.value].sort((a, b) => a.startMs - b.startMs)
  const i = activeCueIndex(list, currentMs.value)
  return i >= 0 ? list[i]!.text : ''
})

// Keep the spoken cue in view while playing (view mode only).
watch(activeIndex, (i) => {
  if (i < 0 || editing.value || !player.value || player.value.paused) return
  nextTick(() => document.getElementById(`cue-${i}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
})

const SIZES = [
  { label: 'S', value: 0.85 },
  { label: 'M', value: 1.1 },
  { label: 'L', value: 1.4 }
]
const overlayScale = ref(1.1)

// ── Second track (dual subtitles) ──────────────────────────────────────────
const siblings = ref<Subtitle[]>([])
const secondaryId = ref<number | 'none'>('none')
const secondaryCues = ref<SubtitleCue[]>([])
const secondaryOptions = computed(() => [
  { label: 'No second track', value: 'none' as const },
  ...siblings.value.map((s) => ({ label: `Also show: ${s.label}`, value: s.id }))
])
const secondaryCue = computed(() => {
  const i = activeCueIndex(secondaryCues.value, currentMs.value)
  return i >= 0 ? secondaryCues.value[i] : null
})

async function loadSiblings() {
  if (!subtitle.value) return
  try {
    siblings.value = (await list({ videoId: subtitle.value.videoId, size: 50, sortBy: 'label', sortOrder: 'asc' })).data.filter(
      (s) => s.id !== subtitle.value!.id && s.cueCount > 0
    )
  } catch {
    siblings.value = []
  }
}
watch(secondaryId, async (sid) => {
  secondaryCues.value = []
  if (sid === 'none') return
  try {
    secondaryCues.value = (await get(sid)).cues ?? []
  } catch (err) {
    toast.add({ title: 'Could not load that track', description: apiErrorMessage(err), color: 'error' })
  }
})

// ── Issues (live: from the draft while editing, else the saved cues) ───────
const liveIssues = computed<SubtitleIssue[]>(() => {
  if (!subtitle.value) return []
  if (!editing.value) return subtitle.value.issues ?? []
  const rows = draft.value.map((r) => ({ startMs: parseTimestamp(r.start) ?? 0, endMs: parseTimestamp(r.end) ?? 0, text: r.text.trim() }))
  return checkSubtitleCues(rows, draftMeta.rules)
})
const issuesByCue = computed(() => {
  const map = new Map<number, SubtitleIssue[]>()
  for (const issue of liveIssues.value) map.set(issue.cueIndex, [...(map.get(issue.cueIndex) ?? []), issue])
  return map
})
const onlyIssues = ref(false)
const visibleIndexes = computed(() => {
  const count = editing.value ? draft.value.length : cues.value.length
  const all = Array.from({ length: count }, (_, i) => i)
  return onlyIssues.value ? all.filter((i) => issuesByCue.value.has(i) || (editing.value && rowErrors.value[i])) : all
})

// ── Editing ────────────────────────────────────────────────────────────────
function snapshot() {
  return JSON.stringify({ meta: draftMeta, rows: draft.value.map(({ start, end, text }) => [start, end, text.trim()]) })
}

function startEditing() {
  const s = subtitle.value
  if (!s) return
  draft.value = cues.value.map((c) => ({ key: nextKey++, start: formatTimestamp(c.startMs), end: formatTimestamp(c.endMs), text: c.text }))
  Object.assign(draftMeta, { label: s.label, language: s.language, kind: s.kind, published: s.published, rules: { ...s.rules } })
  pristine = snapshot()
  conflict.value = ''
  onlyIssues.value = false
  editing.value = true
}

function cancelEditing() {
  editing.value = false
  conflict.value = ''
  draft.value = []
  if (route.query.edit) router.replace({ query: { ...route.query, edit: undefined } })
}

const isDirty = computed(() => editing.value && snapshot() !== pristine)
useUnsavedChangesGuard(isDirty)

const rowErrors = computed(() => draft.value.map((r) => segmentError({ startMs: parseTimestamp(r.start), endMs: parseTimestamp(r.end), text: r.text })))
const invalidCount = computed(() => rowErrors.value.filter(Boolean).length)
const rulesInvalid = computed(() => draftMeta.rules.maxDurationMs <= draftMeta.rules.minDurationMs || !draftMeta.label.trim())

function insertAfter(index: number) {
  const prevEnd = index >= 0 ? parseTimestamp(draft.value[index]!.end) : null
  const start = prevEnd ?? currentMs.value
  draft.value.splice(index + 1, 0, { key: nextKey++, start: formatTimestamp(start), end: formatTimestamp(start + 2000), text: '' })
  nextTick(() => {
    document.getElementById(`cue-${index + 1}`)?.scrollIntoView({ block: 'nearest' })
    document.querySelector<HTMLTextAreaElement>(`#cue-${index + 1} textarea`)?.focus()
  })
}

async function save() {
  const s = subtitle.value
  if (!s || invalidCount.value || rulesInvalid.value) return
  saving.value = true
  conflict.value = ''
  try {
    const cuesChanged = JSON.stringify(draft.value.map(({ start, end, text }) => [start, end, text.trim()])) !== JSON.stringify(JSON.parse(pristine).rows)
    const saved = await update(s.id, {
      version: s.version,
      label: draftMeta.label.trim(),
      language: draftMeta.language,
      kind: draftMeta.kind,
      published: draftMeta.published,
      rules: draftMeta.rules,
      // Only send cues if they changed — a settings-only save keeps the source (Generated/Uploaded).
      cues: cuesChanged ? draft.value.map((r) => ({ startMs: parseTimestamp(r.start)!, endMs: parseTimestamp(r.end)!, text: r.text.trim() })) : undefined
    })
    subtitle.value = saved
    editing.value = false
    draft.value = []
    if (route.query.edit) router.replace({ query: { ...route.query, edit: undefined } })
    toast.add({
      title: 'Subtitle track saved',
      description: saved.issueCount ? `${saved.issueCount} readability warning(s) remain` : 'No readability warnings',
      color: saved.issueCount ? 'warning' : 'success'
    })
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 409 && /changed since/.test(apiErrorMessage(err))) conflict.value = apiErrorMessage(err)
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

// ── Publish / default / download / delete ──────────────────────────────────
async function togglePublished() {
  const s = subtitle.value
  if (!s) return
  busy.value = true
  try {
    subtitle.value = await update(s.id, { version: s.version, label: s.label, language: s.language, kind: s.kind, published: !s.published, rules: s.rules })
    toast.add({ title: subtitle.value.published ? 'Published' : `Unpublished${s.isDefault ? ' — no longer the default track' : ''}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not change visibility', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

const moreItems = computed<DropdownMenuItem[][]>(() => {
  const s = subtitle.value
  if (!s) return []
  return [
    [
      ...(s.published && !s.isDefault ? [{ label: 'Make default track', icon: 'i-lucide-star', onSelect: () => onSetDefault() }] : []),
      { label: 'Regenerate from transcript…', icon: 'i-lucide-refresh-cw', onSelect: () => openRegenerate() }
    ],
    [
      { label: 'Download .vtt', icon: 'i-lucide-download', onSelect: () => onDownload('vtt') },
      { label: 'Download .srt', icon: 'i-lucide-download', onSelect: () => onDownload('srt') }
    ],
    [{ label: 'Delete track', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => (confirmDelete.value = true) }]
  ]
})

async function onSetDefault() {
  if (!subtitle.value) return
  try {
    subtitle.value = await setDefault(subtitle.value.id)
    toast.add({ title: 'Now the default track for this video', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not set default', description: apiErrorMessage(err), color: 'error' })
  }
}

async function onDownload(format: SubtitleFormat) {
  if (!subtitle.value) return
  try {
    const name = await download(subtitle.value.id, format)
    toast.add({ title: `Downloaded ${name}`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Download failed', description: apiErrorMessage(err), color: 'error' })
  }
}

const confirmDelete = ref(false)
async function onDelete() {
  if (!subtitle.value) return
  busy.value = true
  try {
    await remove(subtitle.value.id)
    toast.add({ title: 'Subtitle track deleted', color: 'success' })
    confirmDelete.value = false
    await navigateTo('/subtitles')
  } catch (err) {
    toast.add({ title: 'Could not delete track', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ── Regenerate ─────────────────────────────────────────────────────────────
const showRegenerate = ref(false)
const regenTranscripts = ref<{ id: number; language: string; segmentCount: number; updatedAt: string | null }[]>([])
const regenTranscriptId = ref<number | undefined>()
const regenRules = ref<SubtitleRules>(defaultSubtitleRules(null))
const regenTranscriptOptions = computed(() =>
  regenTranscripts.value.map((t) => ({
    label: `#${t.id} · ${languageLabel(t.language)} · ${t.segmentCount} segments · updated ${formatRelativeTime(t.updatedAt)}`,
    value: t.id
  }))
)

async function openRegenerate() {
  const s = subtitle.value
  if (!s) return
  regenRules.value = { ...s.rules }
  regenTranscriptId.value = undefined
  showRegenerate.value = true
  try {
    // Only same-language transcripts with text can rebuild this track.
    regenTranscripts.value = (await listTranscripts({ videoId: s.videoId, language: s.language, size: 50 })).data.filter((t) => t.segmentCount > 0)
    regenTranscriptId.value = regenTranscripts.value.find((t) => t.id === s.transcriptId)?.id ?? regenTranscripts.value[0]?.id
  } catch {
    regenTranscripts.value = []
  }
}

async function onRegenerate() {
  if (!subtitle.value || !regenTranscriptId.value) return
  busy.value = true
  try {
    subtitle.value = await regenerate(subtitle.value.id, { transcriptId: regenTranscriptId.value, rules: regenRules.value })
    showRegenerate.value = false
    toast.add({
      title: `Regenerated — ${subtitle.value.cueCount} cues`,
      description: subtitle.value.issueCount ? `${subtitle.value.issueCount} readability warning(s)` : 'No readability warnings',
      color: subtitle.value.issueCount ? 'warning' : 'success'
    })
  } catch (err) {
    toast.add({ title: 'Could not regenerate', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await load()
  if (!subtitle.value) return
  loadSiblings()
  if (route.query.edit === '1') startEditing()
  if (route.query.regenerate === '1') {
    router.replace({ query: { ...route.query, regenerate: undefined } })
    openRegenerate()
  }
})
</script>
