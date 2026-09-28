<template>
  <UModal v-model:open="open" title="Edit video" :ui="{ content: 'sm:max-w-2xl', body: 'space-y-5' }">
    <template #body>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
      <template v-else>
        <div class="rounded-lg overflow-hidden bg-black">
          <VideoPlayer ref="preview" :video-url="video.videoUrl" :poster="video.thumbnailUrl" :title="video.title" read-duration @time="onTime" @duration="onDuration">
            <template v-if="mode === 'trim' && cropOn" #overlay>
              <CropOverlay v-model="crop" :natural-width="naturalWidth" :natural-height="naturalHeight" />
            </template>
          </VideoPlayer>
        </div>

        <UTabs v-model="mode" :items="tabItems" variant="link" :ui="{ list: 'mb-3' }">
          <!-- ── Trim & crop ───────────────────────────────────────────── -->
          <template #trim>
            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="tabular-nums font-medium text-gray-900 dark:text-white">{{ formatMsShort(range[0]) }} – {{ formatMsShort(range[1]) }}</span>
                <span class="text-gray-500">of {{ formatMsShort(durationMs) }}</span>
              </div>
              <USlider v-model="range" :min="0" :max="Math.max(durationMs, 1)" :step="100" :min-steps-between-thumbs="500" />
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" color="neutral" variant="soft" @click="range = [Math.round(currentMs), range[1]]">Set start to current time</UButton>
                <UButton size="xs" color="neutral" variant="soft" @click="range = [range[0], Math.round(currentMs)]">Set end to current time</UButton>
              </div>

              <USwitch v-model="cropOn" label="Also crop" @update:model-value="onCropToggle" />
              <div v-if="cropOn" class="grid grid-cols-4 gap-2">
                <UFormField label="X"><UInput v-model.number="crop.x" type="number" size="sm" /></UFormField>
                <UFormField label="Y"><UInput v-model.number="crop.y" type="number" size="sm" /></UFormField>
                <UFormField label="Width"><UInput v-model.number="crop.w" type="number" size="sm" /></UFormField>
                <UFormField label="Height"><UInput v-model.number="crop.h" type="number" size="sm" /></UFormField>
              </div>

              <USwitch v-model="scaleOn" label="Also resize the output" @update:model-value="onScaleToggle" />
              <div v-if="scaleOn" class="grid grid-cols-2 gap-2">
                <UFormField label="Width"><UInput v-model.number="scale.w" type="number" size="sm" /></UFormField>
                <UFormField label="Height"><UInput v-model.number="scale.h" type="number" size="sm" /></UFormField>
              </div>

              <p v-if="trimError" class="text-xs text-error-500">{{ trimError }}</p>
              <UButton v-if="canWrite" block icon="i-lucide-scissors" :loading="starting" :disabled="!!trimError || busy" @click="onStartTrim">
                Start trim
              </UButton>
            </div>
          </template>

          <!-- ── Split into segments ──────────────────────────────────────── -->
          <template #split>
            <div class="space-y-3">
              <div v-for="(seg, i) in segments" :key="i" class="flex items-center gap-2">
                <span class="w-5 text-xs text-gray-400 tabular-nums">{{ i + 1 }}</span>
                <UInput v-model.number="seg.startMsSeconds" type="number" size="sm" :min="0" class="w-24" />
                <span class="text-xs text-gray-400">to</span>
                <UInput v-model.number="seg.endMsSeconds" type="number" size="sm" :min="0" class="w-24" placeholder="end" />
                <span class="text-xs text-gray-400">sec</span>
                <UButton size="xs" color="error" variant="ghost" icon="i-lucide-x" aria-label="Remove segment" :disabled="segments.length <= 1" @click="segments.splice(i, 1)" />
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-plus" @click="segments.push({ startMsSeconds: 0, endMsSeconds: null })">
                  Add segment
                </UButton>
                <span class="text-xs text-gray-500">Split evenly:</span>
                <UButton v-for="n in [2, 3, 4]" :key="n" size="xs" color="neutral" variant="ghost" :disabled="!durationMs" @click="splitEvenly(n)">
                  {{ n }} parts
                </UButton>
              </div>

              <p v-if="splitError" class="text-xs text-error-500">{{ splitError }}</p>
              <UButton v-if="canWrite" block icon="i-lucide-split" :loading="starting" :disabled="!!splitError || busy" @click="onStartSplit">
                Start split
              </UButton>
            </div>
          </template>
        </UTabs>

        <!-- Jobs in progress, or the latest one if it failed -->
        <div v-for="job in visibleJobs" :key="job.id" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
            <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
          </div>
          <JobProgress :status="job.status" :progress="job.progress" :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep" />
        </div>

        <!-- Clips awaiting a decision -->
        <ul v-if="data?.clips.length" class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
          <li v-for="clip in data.clips" :key="clip.id" class="flex items-center gap-3 px-3 py-2">
            <UIcon :name="clip.operation === 'SPLIT' ? 'i-lucide-split' : 'i-lucide-scissors'" class="w-5 h-5 text-primary-500 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {{ clip.operation === 'SPLIT' ? `Segment ${(clip.segmentIndex ?? 0) + 1}` : 'Trim' }} ·
                {{ formatMsShort(clip.startMs) }}{{ clip.endMs != null ? ` – ${formatMsShort(clip.endMs)}` : ' – end' }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ formatFileSize(clip.sizeBytes) }}
                <template v-if="clip.crop"> · cropped {{ clip.crop.w }}×{{ clip.crop.h }}</template>
                <template v-if="clip.scale"> · resized {{ clip.scale.w }}×{{ clip.scale.h }}</template>
                · expires {{ formatRelativeTime(clip.expiresAt) }}
              </p>
            </div>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" :to="clip.url" target="_blank">Preview</UButton>
            <UButton v-if="canWrite" size="xs" :color="clip.operation === 'TRIM' ? 'error' : 'primary'" @click="confirmPromote = clip">
              {{ clip.operation === 'TRIM' ? 'Replace original' : 'Add as new video' }}
            </UButton>
            <UButton v-if="canWrite" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" aria-label="Discard clip" @click="onDiscard(clip)" />
          </li>
        </ul>
      </template>
    </template>
  </UModal>

  <ConfirmModal
    :model-value="confirmPromote !== null"
    :title="confirmPromote?.operation === 'TRIM' ? 'Replace the original video' : 'Add as a new video'"
    :description="
      confirmPromote?.operation === 'TRIM'
        ? 'This replaces the video\'s current file with this trimmed/cropped clip. The old file is deleted and can\'t be recovered.'
        : 'Creates a new, disabled video from this segment — review it before enabling it for learners.'
    "
    :confirm-label="confirmPromote?.operation === 'TRIM' ? 'Replace original' : 'Add as new video'"
    :color="confirmPromote?.operation === 'TRIM' ? 'error' : 'primary'"
    :loading="promoting"
    @update:model-value="(v: boolean) => !v && !promoting && (confirmPromote = null)"
    @confirm="onPromote"
  />
</template>

<script setup lang="ts">
// Trim/crop/scale a range of a video, or split it into segments — both run
// as EDIT jobs (useVideoEdits), producing clips to preview, then promote
// (TRIM replaces the video's file; SPLIT segments become new videos) or
// discard. Polls jobs while any are active, same pattern as VideoDownloadModal.
import type { EditOverview, VideoClip } from '~/composables/useVideoEdits'
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { Video } from '~/composables/useVideos'
import type VideoPlayer from '~/components/VideoPlayer.vue'
import { validateCrop, validateScale, validateSegments, validateTrim } from '#shared/utils/videoEdit'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ video: Video; canWrite: boolean }>()
const emit = defineEmits<{ replaced: []; created: [videoId: number] }>()

const toast = useToast()
const { overview, startTrim, startSplit, promote, remove } = useVideoEdits()

const data = ref<EditOverview | null>(null)
const error = ref('')

async function load() {
  error.value = ''
  try {
    data.value = await overview(props.video.id)
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}

const mode = ref<'trim' | 'split'>('trim')
const tabItems = [
  { label: 'Trim & crop', value: 'trim', slot: 'trim' as const, icon: 'i-lucide-scissors' },
  { label: 'Split into segments', value: 'split', slot: 'split' as const, icon: 'i-lucide-split' }
]

// ── Preview player ───────────────────────────────────────────────────────────
const preview = useTemplateRef<InstanceType<typeof VideoPlayer>>('preview')
const currentMs = ref(0)
const durationMs = ref((props.video.durationSeconds ?? 0) * 1000)
const naturalWidth = ref(props.video.width ?? 0)
const naturalHeight = ref(props.video.height ?? 0)
function onTime(ms: number) {
  currentMs.value = ms
}
function onDuration(seconds: number) {
  durationMs.value = seconds * 1000
  if (range.value[1] === 0) range.value = [0, durationMs.value]
  const el = preview.value?.videoEl
  if (el?.videoWidth) naturalWidth.value = el.videoWidth
  if (el?.videoHeight) naturalHeight.value = el.videoHeight
}

// ── Trim & crop ────────────────────────────────────────────────────────────
const range = ref<[number, number]>([0, durationMs.value])
const cropOn = ref(false)
const crop = reactive({ x: 0, y: 0, w: 0, h: 0 })
function onCropToggle(on: boolean) {
  if (on && !crop.w) Object.assign(crop, { x: Math.round(naturalWidth.value * 0.1), y: Math.round(naturalHeight.value * 0.1), w: Math.round(naturalWidth.value * 0.8), h: Math.round(naturalHeight.value * 0.8) })
}
const scaleOn = ref(false)
const scale = reactive({ w: 0, h: 0 })
function onScaleToggle(on: boolean) {
  if (on && !scale.w) Object.assign(scale, { w: naturalWidth.value || 1280, h: naturalHeight.value || 720 })
}

const trimError = computed(() => {
  const err = validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null)
  if (err) return err
  if (cropOn.value) {
    const e = validateCrop(crop.x, crop.y, crop.w, crop.h, naturalWidth.value || null, naturalHeight.value || null)
    if (e) return e
  }
  if (scaleOn.value) return validateScale(scale.w, scale.h)
  return null
})

const starting = ref(false)
async function onStartTrim() {
  if (trimError.value) return
  starting.value = true
  try {
    const job = await startTrim(props.video.id, {
      startMs: Math.round(range.value[0]),
      endMs: Math.round(range.value[1]),
      crop: cropOn.value ? { x: crop.x, y: crop.y, w: crop.w, h: crop.h } : null,
      scale: scaleOn.value ? { w: scale.w, h: scale.h } : null
    })
    toast.add({ title: `Trim queued — job #${job.id}`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not start the trim', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}

// ── Split into segments ──────────────────────────────────────────────────────
interface SegmentInput {
  startMsSeconds: number
  endMsSeconds: number | null
}
const segments = ref<SegmentInput[]>([{ startMsSeconds: 0, endMsSeconds: null }])
function splitEvenly(n: number) {
  if (!durationMs.value) return
  const stepSeconds = durationMs.value / 1000 / n
  segments.value = Array.from({ length: n }, (_, i) => ({
    startMsSeconds: Math.round(i * stepSeconds),
    endMsSeconds: i === n - 1 ? null : Math.round((i + 1) * stepSeconds)
  }))
}
const splitError = computed(() =>
  validateSegments(
    segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) })),
    Math.round(durationMs.value) || null
  )
)
async function onStartSplit() {
  if (splitError.value) return
  starting.value = true
  try {
    const job = await startSplit(
      props.video.id,
      segments.value.map((s) => ({ startMs: Math.round(s.startMsSeconds * 1000), endMs: s.endMsSeconds == null ? null : Math.round(s.endMsSeconds * 1000) }))
    )
    toast.add({ title: `Split queued — job #${job.id}`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not start the split', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}

// ── Jobs (poll while any are active) ─────────────────────────────────────────
const visibleJobs = computed<ProcessingJob[]>(() => {
  const jobs = data.value?.jobs ?? []
  const active = jobs.filter((j) => isActiveJobStatus(j.status))
  const latest = jobs[0]
  return latest && latest.status === 'FAILED' ? [...active, latest] : active
})
const busy = computed(() => visibleJobs.value.some((j) => isActiveJobStatus(j.status)))
function jobLabel(job: ProcessingJob) {
  let operation = 'Edit'
  try {
    operation = JSON.parse(job.parameters ?? '{}').operation === 'SPLIT' ? 'Split' : 'Trim'
  } catch {
    // Default label above.
  }
  if (job.status === 'FAILED') return `${operation} failed`
  return job.status === 'QUEUED' ? `${operation} — waiting` : `${operation} in progress`
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch([busy, open], ([isBusy, isOpen]) => {
  clearInterval(pollTimer)
  if (!isBusy || !isOpen) return
  pollTimer = setInterval(load, 3000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

watch(open, (isOpen) => {
  if (!isOpen) return
  mode.value = 'trim'
  cropOn.value = false
  scaleOn.value = false
  segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
  durationMs.value = (props.video.durationSeconds ?? 0) * 1000
  naturalWidth.value = props.video.width ?? 0
  naturalHeight.value = props.video.height ?? 0
  range.value = [0, durationMs.value]
  load()
})

// ── Promote / discard ────────────────────────────────────────────────────────
const confirmPromote = ref<VideoClip | null>(null)
const promoting = ref(false)
async function onPromote() {
  if (!confirmPromote.value) return
  promoting.value = true
  try {
    const result = await promote(props.video.id, confirmPromote.value.id)
    if (result.kind === 'REPLACED') {
      toast.add({ title: 'Video replaced', description: 'The edited clip is now the video\'s file.', color: 'success' })
      emit('replaced')
    } else {
      toast.add({ title: 'New video created', description: 'It\'s disabled until you review and enable it.', color: 'success' })
      if (result.newVideoId) emit('created', result.newVideoId)
    }
    confirmPromote.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not apply the clip', description: apiErrorMessage(err), color: 'error' })
  } finally {
    promoting.value = false
  }
}

async function onDiscard(clip: VideoClip) {
  try {
    await remove(props.video.id, clip.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not discard the clip', description: apiErrorMessage(err), color: 'error' })
  }
}

function formatMsShort(ms: number) {
  return formatDuration(Math.round(ms / 1000))
}
</script>
