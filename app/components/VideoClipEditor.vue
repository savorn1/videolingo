<template>
  <div class="space-y-4">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <!-- Preview (large, stays in view while scrolling the controls) -->
      <!-- The stage is what goes full screen, so crop, zoom and the playback bar come along. -->
      <div
        ref="stage"
        data-testid="preview-stage"
        class="xl:col-span-2 xl:sticky xl:top-4 space-y-2"
        :class="stageFullscreen ? 'dark bg-black p-4 flex flex-col justify-center' : ''"
      >
        <!-- Zoomable preview: scroll over it to zoom toward the pointer; when
             zoomed, Space+drag / middle-drag pans. A plain drag crops. -->
        <div
          ref="zoomBox"
          data-testid="preview-zoom"
          class="group relative rounded-lg overflow-hidden bg-black"
          :class="panning ? 'cursor-grabbing' : zoom > 1 && spaceHeld ? 'cursor-grab' : ''"
          :style="fitStyle"
          @wheel="onPreviewWheel"
          @pointerdown.capture="onPanStart"
          @pointerdown="onQuickCropStart"
          @pointerenter="hovering = true"
          @pointerleave="hovering = false"
        >
          <div :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }">
            <VideoPlayer
              ref="preview"
              :video-url="video.videoUrl"
              :poster="video.thumbnailUrl"
              :title="video.title"
              read-duration
              @time="onTime"
              @duration="onDuration"
            >
              <template v-if="cropActive" #overlay>
                <CropOverlay
                  ref="cropLayer"
                  :model-value="crop"
                  :natural-width="naturalWidth"
                  :natural-height="naturalHeight"
                  :aspect="cropAspect"
                  :zoom="zoom"
                  @update:model-value="(v) => Object.assign(crop, v)"
                />
              </template>
            </VideoPlayer>
          </div>

          <div
            class="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1 py-0.5 text-white transition-opacity"
            :class="zoom > 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <button type="button" class="p-1 rounded hover:bg-white/15 disabled:opacity-40" aria-label="Zoom out" :disabled="zoom <= 1" @click="zoomBy(1 / 1.25)">
              <UIcon name="i-lucide-zoom-out" class="w-4 h-4 block" />
            </button>
            <button
              type="button"
              class="px-1 text-xs font-medium tabular-nums min-w-11 rounded hover:bg-white/15"
              title="Reset zoom (scroll over the video to zoom)"
              @click="resetZoom"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button type="button" class="p-1 rounded hover:bg-white/15 disabled:opacity-40" aria-label="Zoom in" :disabled="zoom >= MAX_ZOOM" @click="zoomBy(1.25)">
              <UIcon name="i-lucide-zoom-in" class="w-4 h-4 block" />
            </button>
          </div>
        </div>
        <EditorTransport
          :player="preview"
          :selection="mode === 'trim' ? range : mode === 'audio' ? audioEdit.state.range : null"
          :fullscreen-target="stage"
          :space-taken="hovering && zoom > 1"
          :style="fitStyle"
        />
        <AudioStrip
          v-if="mode === 'audio'"
          :edit="audioEdit"
          :duration-ms="durationMs"
          :current-ms="currentMs"
          :style="fitStyle"
          @seek="(ms: number) => preview?.seek(ms, false)"
        />
        <p v-if="!stageFullscreen" class="text-xs text-gray-500 dark:text-gray-400">
          Drag on the video to crop · scroll over it to zoom · hold <UKbd value="space" /> and drag to move around when zoomed ·
          <UKbd value="space" /> / <UKbd value="K" /> play · <UKbd value="←" /> <UKbd value="→" /> one frame · <UKbd value="J" />
          <UKbd value="L" /> ±5 s · <UKbd value="F" /> full screen
        </p>
      </div>

      <!-- Controls -->
      <UCard>
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
              <template v-if="cropOn">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  Drag on the video to draw the area to keep — drag inside it to move, drag the white handles to resize. Use the playback bar under
                  the video (or the trim handles above) to check other frames.
                </p>
                <div class="flex flex-wrap items-center gap-1">
                  <span class="text-xs text-gray-500 mr-1">Shape</span>
                  <UButton
                    v-for="a in ASPECTS"
                    :key="a.label"
                    size="xs"
                    :color="cropAspect === a.value ? 'primary' : 'neutral'"
                    :variant="cropAspect === a.value ? 'soft' : 'ghost'"
                    @click="setAspect(a.value)"
                  >
                    {{ a.label }}
                  </UButton>
                  <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-maximize" class="ml-auto" @click="cropFull">Whole frame</UButton>
                </div>
              </template>
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

              <!-- Always takes its line, so the layout (and the video) don't jump while a crop is being drawn. -->
              <p class="text-xs text-error-500 min-h-4">{{ trimError }}</p>
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
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-x"
                  aria-label="Remove segment"
                  :disabled="segments.length <= 1"
                  @click="segments.splice(i, 1)"
                />
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
          <!-- ── Audio ─────────────────────────────────────────────────── -->
          <template #audio>
            <AudioEditPanel
              :edit="audioEdit"
              :video-id="video.id"
              :duration-ms="durationMs"
              :current-ms="currentMs"
              :can-write="canWrite"
              :busy="busy"
              @queued="load"
            />
          </template>
        </UTabs>
      </UCard>
    </div>

    <!-- Results: jobs in progress (or the latest failure), then clips awaiting a decision -->
    <UCard :ui="{ body: 'space-y-3' }">
      <template #header>
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-gray-900 dark:text-white">Results</h2>
          <UBadge v-if="data?.clips.length" color="neutral" variant="subtle" size="sm">{{ data.clips.length }}</UBadge>
        </div>
      </template>

      <div v-for="job in visibleJobs" :key="job.id" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
          <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
        </div>
        <JobProgress :status="job.status" :progress="job.progress" :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep" />
      </div>

      <EmptyState
        v-if="!visibleJobs.length && !data?.clips.length"
        icon="i-lucide-clapperboard"
        title="Nothing yet"
        description="Start a trim, split or audio edit — the results appear here to preview, then replace the original or add as new videos."
        class="py-6"
      />

      <ul v-if="data?.clips.length" class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
          <li v-for="clip in data.clips" :key="clip.id" class="flex items-center gap-3 px-3 py-2">
            <UIcon :name="CLIP_ICONS[clip.operation]" class="w-5 h-5 text-primary-500 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ clipTitle(clip) }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                <template v-if="clip.summary">{{ clip.summary }} · </template>
                {{ formatFileSize(clip.sizeBytes) }}
                <template v-if="clip.crop"> · cropped {{ clip.crop.w }}×{{ clip.crop.h }}</template>
                <template v-if="clip.scale"> · resized {{ clip.scale.w }}×{{ clip.scale.h }}</template>
                · expires {{ formatTimeUntil(clip.expiresAt) }}
              </p>
              <audio v-if="clip.operation === 'EXTRACT'" :src="clip.url" controls preload="none" class="mt-1 h-8 w-full max-w-sm" />
            </div>
            <template v-if="clip.operation === 'EXTRACT'">
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-download" :href="clip.url" download>Download</UButton>
            </template>
            <template v-else>
              <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" :to="clip.url" target="_blank">Preview</UButton>
              <UButton v-if="canWrite" size="xs" :color="replaces(clip) ? 'warning' : 'primary'" @click="confirmPromote = clip">
                {{ replaces(clip) ? 'Replace original' : 'Add as new video' }}
              </UButton>
            </template>
            <UButton v-if="canWrite" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" aria-label="Discard clip" @click="onDiscard(clip)" />
          </li>
      </ul>
    </UCard>

    <ConfirmModal
      :model-value="confirmPromote !== null"
      :title="confirmPromote && replaces(confirmPromote) ? 'Replace the original video' : 'Add as a new video'"
      :description="
        confirmPromote && replaces(confirmPromote)
          ? `This replaces the video's current file with ${confirmPromote.operation === 'AUDIO' ? 'the version with the edited sound' : 'this trimmed/cropped clip'}. The current file is kept under Versions, so you can restore it.`
          : 'Creates a new, disabled video from this segment — review it before enabling it for learners.'
      "
      :confirm-label="confirmPromote && replaces(confirmPromote) ? 'Replace original' : 'Add as new video'"
      :color="confirmPromote && replaces(confirmPromote) ? 'warning' : 'primary'"
      :loading="promoting"
      @update:model-value="(v: boolean) => !v && !promoting && (confirmPromote = null)"
      @confirm="onPromote"
    />
  </div>
</template>

<script setup lang="ts">
// The video editor (its own page, /videos/:id/editor): trim/crop/scale a
// range of a video, split it into segments, or edit its sound — all run as
// EDIT jobs (useVideoEdits), producing clips to preview, then promote (TRIM
// and AUDIO replace the video's file; SPLIT segments become new videos),
// download (extracted audio) or discard. Polls jobs
// while any are active, same pattern as VideoDownloadModal.
import type { EditOverview, VideoClip } from '~/composables/useVideoEdits'
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { Video } from '~/composables/useVideos'
import type VideoPlayer from '~/components/VideoPlayer.vue'
import { validateCrop, validateScale, validateSegments, validateTrim } from '#shared/utils/videoEdit'
import { isMutedAt } from '#shared/utils/audioEdit'
import { formatTimeUntil } from '#shared/utils/format'

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

const mode = ref<'trim' | 'split' | 'audio'>('trim')
const tabItems = [
  { label: 'Trim & crop', value: 'trim', slot: 'trim' as const, icon: 'i-lucide-scissors' },
  { label: 'Split', value: 'split', slot: 'split' as const, icon: 'i-lucide-split' },
  { label: 'Audio', value: 'audio', slot: 'audio' as const, icon: 'i-lucide-audio-lines' }
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

// ── Zoom & pan the preview ───────────────────────────────────────────────────
// A CSS transform on a wrapper (origin top-left): screen = pan + zoom × local.
const zoomBox = useTemplateRef<HTMLDivElement>('zoomBox')
const MAX_ZOOM = 6
const zoom = ref(1)
const pan = reactive({ x: 0, y: 0 })
const hovering = ref(false)
const spaceHeld = ref(false)
const panning = ref(false)
const cropActive = computed(() => mode.value === 'trim' && cropOn.value)

// Keeps the zoomed picture covering the frame — no panning off into empty space.
function clampPan() {
  const el = zoomBox.value
  if (!el) return
  pan.x = Math.min(0, Math.max(el.clientWidth * (1 - zoom.value), pan.x))
  pan.y = Math.min(0, Math.max(el.clientHeight * (1 - zoom.value), pan.y))
}
// Zooms keeping the point (sx, sy) — in frame coordinates — where it is on screen.
function zoomAt(factor: number, sx: number, sy: number) {
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom.value * factor))
  if (next === zoom.value) return
  pan.x = sx - ((sx - pan.x) * next) / zoom.value
  pan.y = sy - ((sy - pan.y) * next) / zoom.value
  zoom.value = next
  clampPan()
}
function zoomBy(factor: number) {
  const el = zoomBox.value
  if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2)
}
function resetZoom() {
  zoom.value = 1
  pan.x = 0
  pan.y = 0
}
function onPreviewWheel(e: WheelEvent) {
  // At 100%, scrolling "out" is left to the modal, so the page still scrolls normally.
  if (zoom.value <= 1 && e.deltaY > 0) return
  e.preventDefault()
  const r = zoomBox.value!.getBoundingClientRect()
  zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
}

// A drag that moved shouldn't also count as a click (which would play/pause the video).
function swallowNextClick() {
  const swallow = (ev: MouseEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
}

// Pans on Space+drag or middle-drag (plain drags are for cropping). Runs in
// the capture phase so it wins over the crop layer and the player.
function onPanStart(e: PointerEvent) {
  if (zoom.value <= 1) return
  if (e.button !== 1 && !(e.button === 0 && spaceHeld.value)) return
  e.preventDefault()
  e.stopPropagation()
  panning.value = true
  const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
  let moved = false
  const move = (ev: PointerEvent) => {
    moved ||= Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 3
    pan.x = start.px + ev.clientX - start.x
    pan.y = start.py + ev.clientY - start.y
    clampPan()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener(
    'pointerup',
    () => {
      window.removeEventListener('pointermove', move)
      panning.value = false
      if (moved) swallowNextClick()
    },
    { once: true }
  )
}

// With crop off, dragging across the picture switches it on and draws the box
// — no need to find the switch first. A plain click still plays/pauses, and
// drags that start on the player's control bar are left to the player.
const cropLayer = useTemplateRef<{ beginDraw: (from: { clientX: number; clientY: number }, to?: PointerEvent) => void }>('cropLayer')
const CONTROL_BAR_PX = 56
function onQuickCropStart(e: PointerEvent) {
  if (e.button !== 0 || spaceHeld.value || mode.value !== 'trim' || cropOn.value) return
  const r = zoomBox.value!.getBoundingClientRect()
  if (e.clientY >= r.top + pan.y + zoom.value * (r.height - CONTROL_BAR_PX)) return
  const from = { clientX: e.clientX, clientY: e.clientY }
  const move = async (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - from.clientX, ev.clientY - from.clientY) < 6) return
    cleanup()
    cropOn.value = true
    await nextTick()
    cropLayer.value?.beginDraw(from, ev)
    window.addEventListener('pointerup', swallowNextClick, { once: true })
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', cleanup)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', cleanup, { once: true })
}

// Only text entry keeps its Space. A focused button (e.g. the "Also crop"
// switch just clicked) doesn't — Space must pan, not re-toggle it.
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
}
function onKeyDown(e: KeyboardEvent) {
  // Only when zoomed: otherwise Space plays/pauses (EditorTransport).
  if (e.code !== 'Space' || !hovering.value || zoom.value <= 1 || isTyping(e.target)) return
  e.preventDefault()
  spaceHeld.value = true
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code !== 'Space' || !spaceHeld.value) return
  e.preventDefault()
  spaceHeld.value = false
}
// ── Full screen ──────────────────────────────────────────────────────────────
// The player keeps its 16:9 box, so in full screen it's sized to fit the
// height left over by the playback bar; the bar matches its width.
const stage = useTemplateRef<HTMLDivElement>('stage')
const stageFullscreen = ref(false)
const fitStyle = computed(() => (stageFullscreen.value ? { width: 'min(100%, calc((100vh - 7.5rem) * 16 / 9))', marginInline: 'auto' } : undefined))
function onFullscreenChange() {
  stageFullscreen.value = !!stage.value && document.fullscreenElement === stage.value
  nextTick(clampPan)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

// ── Trim & crop ────────────────────────────────────────────────────────────
const range = ref<[number, number]>([0, durationMs.value])
// Starts with no selection: the first drag on the video draws it. (A
// pre-made box covering most of the frame meant almost every press landed
// inside it and moved it instead.)
const cropOn = ref(false)
const crop = reactive({ x: 0, y: 0, w: 0, h: 0 })
function onCropToggle(on: boolean) {
  if (!on) {
    cropAspect.value = null
    Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
  }
}

const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 }
]
const cropAspect = ref<number | null>(null)
// Picking a shape fits the largest box of that shape, centred on the current crop.
function setAspect(aspect: number | null) {
  cropAspect.value = aspect
  if (!aspect || !naturalWidth.value || !naturalHeight.value) return
  const cx = crop.w ? crop.x + crop.w / 2 : naturalWidth.value / 2
  const cy = crop.h ? crop.y + crop.h / 2 : naturalHeight.value / 2
  let w = naturalWidth.value
  let h = w / aspect
  if (h > naturalHeight.value) {
    h = naturalHeight.value
    w = h * aspect
  }
  const x = Math.min(Math.max(cx - w / 2, 0), naturalWidth.value - w)
  const y = Math.min(Math.max(cy - h / 2, 0), naturalHeight.value - h)
  Object.assign(crop, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) })
}
function cropFull() {
  cropAspect.value = null
  Object.assign(crop, { x: 0, y: 0, w: naturalWidth.value, h: naturalHeight.value })
}

// While cropping, the crop layer covers the player's own controls — moving a
// trim handle shows that frame instead, so the crop can be checked anywhere.
watch(
  () => range.value[0],
  (ms) => cropOn.value && preview.value?.seek(ms, false)
)
watch(
  () => range.value[1],
  (ms) => cropOn.value && preview.value?.seek(ms, false)
)
const scaleOn = ref(false)
const scale = reactive({ w: 0, h: 0 })
function onScaleToggle(on: boolean) {
  if (on && !scale.w) Object.assign(scale, { w: naturalWidth.value || 1280, h: naturalHeight.value || 720 })
}

const trimError = computed(() => {
  const err = validateTrim(Math.round(range.value[0]), Math.round(range.value[1]), Math.round(durationMs.value) || null)
  if (err) return err
  if (cropOn.value) {
    if (!crop.w || !crop.h) return 'Drag on the video to choose the area to keep'
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
const JOB_LABELS: Record<string, string> = { TRIM: 'Trim', SPLIT: 'Split', AUDIO: 'Audio edit', EXTRACT: 'Audio extract' }
function jobLabel(job: ProcessingJob) {
  let operation = 'Edit'
  try {
    operation = JOB_LABELS[JSON.parse(job.parameters ?? '{}').operation] ?? 'Edit'
  } catch {
    // Default label above.
  }
  if (job.status === 'FAILED') return `${operation} failed`
  return job.status === 'QUEUED' ? `${operation} — waiting` : `${operation} in progress`
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch(busy, (isBusy) => {
  clearInterval(pollTimer)
  if (isBusy) pollTimer = setInterval(load, 3000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

// Fresh state on load, and again whenever the video's file changes
// (e.g. after "Replace original") — the old ranges/crop don't apply to it.
function reset() {
  mode.value = 'trim'
  cropOn.value = false
  resetZoom()
  cropAspect.value = null
  Object.assign(crop, { x: 0, y: 0, w: 0, h: 0 })
  scaleOn.value = false
  segments.value = [{ startMsSeconds: 0, endMsSeconds: null }]
  durationMs.value = (props.video.durationSeconds ?? 0) * 1000
  naturalWidth.value = props.video.width ?? 0
  naturalHeight.value = props.video.height ?? 0
  range.value = [0, durationMs.value]
  audioEdit.reset()
  load()
}
onMounted(reset)
watch(() => props.video.videoUrl, reset)

// ── Audio ────────────────────────────────────────────────────────────────────
const audioEdit = useAudioEdit(durationMs)

// While on the Audio tab the preview plays the level and the muted ranges
// (the rest needs rendering). The <video> can't go above 100%.
watchEffect(() => {
  const el = preview.value?.videoEl
  if (!el) return
  if (mode.value !== 'audio') {
    el.volume = 1
    el.muted = false
    return
  }
  const s = audioEdit.state
  el.volume = Math.min(1, s.volume)
  el.muted = s.volume === 0 || isMutedAt(s.mutes, currentMs.value)
})

// ── Promote / discard ────────────────────────────────────────────────────────
const CLIP_ICONS: Record<VideoClip['operation'], string> = {
  TRIM: 'i-lucide-scissors',
  SPLIT: 'i-lucide-split',
  AUDIO: 'i-lucide-audio-lines',
  EXTRACT: 'i-lucide-file-audio'
}
function replaces(clip: VideoClip) {
  return clip.operation === 'TRIM' || clip.operation === 'AUDIO'
}
function clipTitle(clip: VideoClip) {
  switch (clip.operation) {
    case 'SPLIT':
      return `Segment ${(clip.segmentIndex ?? 0) + 1} · ${formatMsShort(clip.startMs)}${clip.endMs != null ? ` – ${formatMsShort(clip.endMs)}` : ' – end'}`
    case 'AUDIO':
      return 'Audio edit'
    case 'EXTRACT':
      return 'Extracted audio'
    default:
      return `Trim · ${formatMsShort(clip.startMs)}${clip.endMs != null ? ` – ${formatMsShort(clip.endMs)}` : ' – end'}`
  }
}
const confirmPromote = ref<VideoClip | null>(null)
const promoting = ref(false)
async function onPromote() {
  if (!confirmPromote.value) return
  promoting.value = true
  try {
    const result = await promote(props.video.id, confirmPromote.value.id)
    if (result.kind === 'REPLACED') {
      toast.add({ title: 'Video replaced', description: "The edited clip is now the video's file.", color: 'success' })
      emit('replaced')
    } else {
      toast.add({ title: 'New video created', description: "It's disabled until you review and enable it.", color: 'success' })
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
