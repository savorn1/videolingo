<template>
  <div data-testid="transport" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 pt-2 pb-1.5 space-y-1">
    <div class="relative">
      <!-- The trim selection, drawn along the seek bar. -->
      <div
        v-if="selection && durationMs && !selectionEditable"
        class="absolute -top-1 h-1 rounded-full bg-primary-500/50 pointer-events-none"
        :class="loopOn ? 'bg-primary-500' : ''"
        :style="{ left: pct(selection[0]), width: pct(Math.min(selection[1], durationMs) - selection[0]) }"
      />
      <!-- Trim tab: the same range with a handle on each end to drag (arrow keys nudge, Shift for 1 s). -->
      <div
        v-if="selection && durationMs && selectionEditable"
        ref="track"
        class="relative mb-1 h-5 rounded bg-gray-100 dark:bg-gray-800"
        data-testid="range-track"
      >
        <div
          class="absolute inset-y-0 bg-primary-500/40 pointer-events-none"
          :class="loopOn ? 'bg-primary-500/60' : ''"
          :style="{ left: pct(selection[0]), width: pct(Math.min(selection[1], durationMs) - selection[0]) }"
        />
        <div
          v-for="edge in RANGE_EDGES"
          :key="edge.key"
          role="slider"
          tabindex="0"
          class="absolute inset-y-0 z-10 w-2 -translate-x-1/2 cursor-ew-resize touch-none rounded bg-primary-600 hover:bg-primary-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
          :style="{ left: pct(selection[edge.index]) }"
          :aria-label="edge.label"
          :aria-valuemin="0"
          :aria-valuemax="Math.round(durationMs)"
          :aria-valuenow="Math.round(selection[edge.index]!)"
          :aria-valuetext="formatTimecode(selection[edge.index]!)"
          :title="`${edge.label} — ${formatTimecode(selection[edge.index]!)}`"
          @pointerdown.prevent="startDrag(edge.key, $event)"
          @pointermove="onDrag(edge.key, $event)"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @keydown="onHandleKey(edge.key, $event)"
        />
      </div>
      <USlider
        :model-value="timeMs"
        :min="0"
        :max="Math.max(durationMs, 1)"
        :step="10"
        size="sm"
        aria-label="Seek"
        :disabled="!el"
        @update:model-value="(v) => typeof v === 'number' && seekTo(v)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-0.5">
      <UButton
        v-bind="btn"
        :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
        :aria-label="playing ? 'Pause' : 'Play'"
        title="Play / pause (Space, K)"
        @click="togglePlay"
      />
      <UButton
        v-bind="btn"
        icon="i-lucide-square"
        aria-label="Stop"
        :title="loopOn && selection ? 'Stop — back to the selection start (Home)' : 'Stop — back to the start (Home)'"
        @click="stop"
      />
      <UButton v-bind="btn" icon="i-lucide-step-back" aria-label="Previous frame" title="Previous frame (←) · Shift+← 10 s back" @click="step(-1)" />
      <UButton v-bind="btn" icon="i-lucide-step-forward" aria-label="Next frame" title="Next frame (→) · Shift+→ 10 s ahead" @click="step(1)" />

      <span class="ml-2 text-xs tabular-nums text-gray-900 dark:text-white" data-testid="transport-time">{{ formatTimecode(timeMs) }}</span>
      <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">/ {{ formatTimecode(durationMs) }}</span>
      <span
        class="ml-2 hidden sm:inline text-xs tabular-nums text-gray-500 dark:text-gray-400"
        :title="fpsMeasured ? 'Measured from the video' : 'Assumed until the video has played for a moment'"
      >
        frame {{ frameNo }} · {{ fpsMeasured ? '' : '~' }}{{ fps }} fps
      </span>

      <div class="ml-auto flex items-center gap-0.5">
        <UButton
          v-if="selection"
          size="xs"
          :color="loopOn ? 'primary' : 'neutral'"
          :variant="loopOn ? 'soft' : 'ghost'"
          icon="i-lucide-repeat"
          :aria-pressed="loopOn"
          title="Loop the trim selection"
          @click="toggleLoop"
        >
          Loop selection
        </UButton>
        <!-- No portal: in full screen only the stage is visible, so the menu must render inside it. -->
        <USelect
          :model-value="rate"
          :items="rateItems"
          size="xs"
          class="w-20"
          aria-label="Playback speed"
          :portal="false"
          :disabled="!el"
          @update:model-value="(v) => player?.setRate(Number(v))"
        />
        <UButton
          v-if="pipSupported"
          v-bind="btn"
          icon="i-lucide-picture-in-picture-2"
          :aria-label="inPip ? 'Exit picture-in-picture' : 'Picture-in-picture'"
          :title="inPip ? 'Exit picture-in-picture' : 'Picture-in-picture'"
          @click="togglePip"
        />
        <UButton
          v-if="fsSupported"
          v-bind="btn"
          :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
          :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'"
          title="Full screen (F)"
          @click="toggleFullscreen"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Playback controls for the editor preview. The browser's own bar sits under
// the crop layer while cropping, and has no frame stepping, looping or (in
// most browsers) speed — so the editor drives the <video> from here.
import { withTrimEdge } from '#shared/utils/videoEdit'
import { EDITOR_RATES, FALLBACK_FPS, estimateFps, formatTimecode, loopedTime, stepFrameTime } from '#shared/utils/transport'

interface PlayerHandle {
  videoEl: HTMLVideoElement | null
  seek: (ms: number, play?: boolean) => void
  setRate: (value: number) => void
}

const props = defineProps<{
  player: PlayerHandle | null
  /** The trim selection in ms — what "Loop selection" keeps playback inside. */
  selection?: [number, number] | null
  /** Draw handles on the selection that can be dragged (the Trim tab); changes go out as `update:selection`. */
  selectionEditable?: boolean
  /** What goes full screen: the whole preview stage, so crop and zoom come along. */
  fullscreenTarget?: HTMLElement | null
  /** Space is busy elsewhere (panning the zoomed preview under the pointer). */
  spaceTaken?: boolean
  /** Arrow keys are busy elsewhere (nudging a selected overlay layer). */
  arrowKeysTaken?: boolean
}>()

/** How far J, L and Shift+← / Shift+→ jump. */
const SHIFT_SKIP_SECONDS = 10
const btn = { size: 'sm', color: 'neutral', variant: 'ghost', square: true } as const
const rateItems = EDITOR_RATES.map((v) => ({ label: `${v}×`, value: v }))

const el = computed(() => props.player?.videoEl ?? null)
const playing = ref(false)
const timeMs = ref(0)
const durationMs = ref(0)
const rate = ref(1)
const inPip = ref(false)
const loopOn = ref(false)
const fps = ref(FALLBACK_FPS)
const fpsMeasured = ref(false)
const frameNo = computed(() => Math.floor((timeMs.value / 1000) * fps.value + 1e-6))

const emit = defineEmits<{ 'update:selection': [range: [number, number]] }>()

const RANGE_EDGES = [
  { key: 'start', index: 0, label: 'Trim start' },
  { key: 'end', index: 1, label: 'Trim end' }
] as const
const track = useTemplateRef<HTMLElement>('track')
const dragging = ref(false)

function moveEdge(edge: 'start' | 'end', ms: number) {
  if (!props.selection) return
  emit('update:selection', withTrimEdge(props.selection, edge, ms, durationMs.value))
}
function startDrag(_edge: 'start' | 'end', e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragging.value = true
}
function onDrag(edge: 'start' | 'end', e: PointerEvent) {
  const box = track.value?.getBoundingClientRect()
  if (!dragging.value || !box?.width) return
  moveEdge(edge, ((e.clientX - box.left) / box.width) * durationMs.value)
}
function endDrag() {
  dragging.value = false
}
function onHandleKey(edge: 'start' | 'end', e: KeyboardEvent) {
  const dir = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (!dir || !props.selection) return
  e.preventDefault()
  e.stopPropagation()
  moveEdge(edge, props.selection[edge === 'start' ? 0 : 1] + dir * (e.shiftKey ? 1000 : 100))
}

function pct(ms: number) {
  return `${Math.min(1, Math.max(0, ms) / Math.max(durationMs.value, 1)) * 100}%`
}
function selectionSeconds(): [number, number] | null {
  return props.selection ? [props.selection[0] / 1000, props.selection[1] / 1000] : null
}

// ── Following the <video> ────────────────────────────────────────────────────
function syncFrom(v: HTMLVideoElement) {
  playing.value = !v.paused && !v.ended
  timeMs.value = v.currentTime * 1000
  durationMs.value = Number.isFinite(v.duration) ? v.duration * 1000 : 0
  rate.value = v.playbackRate
}

// While playing, one tick per animation frame: smooth time display, and the
// loop check (timeupdate only fires ~4× a second — too late for a tight loop).
let raf = 0
function tick() {
  const v = el.value
  raf = 0
  if (!v) return
  enforceLoop(v)
  timeMs.value = v.currentTime * 1000
  if (!v.paused) raf = requestAnimationFrame(tick)
}
function enforceLoop(v: HTMLVideoElement) {
  const sel = selectionSeconds()
  if (!loopOn.value || !sel) return
  const to = loopedTime(v.currentTime, sel)
  if (to != null) v.currentTime = to
}

// Frame rate: the gaps in media time between frames the browser presents.
// Only while playing; until then FALLBACK_FPS is assumed.
const deltas: number[] = []
let lastMediaTime: number | null = null
function measureFps(v: HTMLVideoElement) {
  if (fpsMeasured.value || !('requestVideoFrameCallback' in v)) return
  const onFrame: VideoFrameRequestCallback = (_now, meta) => {
    if (lastMediaTime != null) deltas.push(meta.mediaTime - lastMediaTime)
    lastMediaTime = meta.mediaTime
    const found = deltas.length >= 24 ? estimateFps(deltas) : null
    if (found) {
      fps.value = found
      fpsMeasured.value = true
    } else if (!v.paused) v.requestVideoFrameCallback(onFrame)
  }
  lastMediaTime = null
  v.requestVideoFrameCallback(onFrame)
}

watch(
  el,
  (v, _old, onCleanup) => {
    if (!v) return
    fps.value = FALLBACK_FPS
    fpsMeasured.value = false
    deltas.length = 0
    syncFrom(v)
    const onPlay = () => {
      playing.value = true
      if (!raf) raf = requestAnimationFrame(tick)
      measureFps(v)
    }
    const onPause = () => (playing.value = false)
    const onTime = () => (timeMs.value = v.currentTime * 1000)
    const onMeta = () => syncFrom(v)
    const onRate = () => (rate.value = v.playbackRate)
    const onEnded = () => {
      // A selection that runs to the very end: the video stops before the loop check can wrap it.
      const sel = selectionSeconds()
      if (loopOn.value && sel) {
        v.currentTime = sel[0]
        v.play().catch(() => {})
      }
    }
    const onPip = () => (inPip.value = document.pictureInPictureElement === v)
    const events: [string, () => void][] = [
      ['play', onPlay],
      ['pause', onPause],
      ['timeupdate', onTime],
      ['seeked', onTime],
      ['loadedmetadata', onMeta],
      ['durationchange', onMeta],
      ['ratechange', onRate],
      ['ended', onEnded],
      ['enterpictureinpicture', onPip],
      ['leavepictureinpicture', onPip]
    ]
    for (const [name, fn] of events) v.addEventListener(name, fn)
    if (playing.value) onPlay()
    onCleanup(() => {
      for (const [name, fn] of events) v.removeEventListener(name, fn)
      cancelAnimationFrame(raf)
      raf = 0
    })
  },
  { immediate: true, flush: 'post' }
)
onBeforeUnmount(() => cancelAnimationFrame(raf))

// ── Controls ─────────────────────────────────────────────────────────────────
function seekTo(ms: number) {
  const max = durationMs.value || Infinity
  props.player?.seek(Math.min(Math.max(0, ms), max), false)
  timeMs.value = Math.min(Math.max(0, ms), max)
}

function togglePlay() {
  const v = el.value
  if (!v) return
  if (v.paused || v.ended) {
    const sel = selectionSeconds()
    if (loopOn.value && sel && loopedTime(v.currentTime, sel) != null) v.currentTime = sel[0]
    v.play().catch(() => {})
  } else v.pause()
}

function stop() {
  const v = el.value
  if (!v) return
  v.pause()
  seekTo(loopOn.value && props.selection ? props.selection[0] : 0)
}

function step(dir: 1 | -1) {
  const v = el.value
  if (!v) return
  v.pause()
  seekTo(stepFrameTime(v.currentTime, fps.value, dir, Number.isFinite(v.duration) ? v.duration : undefined) * 1000)
}

function skip(seconds: number) {
  const v = el.value
  if (v) seekTo((v.currentTime + seconds) * 1000)
}

function toggleLoop() {
  loopOn.value = !loopOn.value
  const v = el.value
  if (loopOn.value && v && !v.paused) enforceLoop(v)
}

// ── Picture-in-picture & full screen ─────────────────────────────────────────
const pipSupported = ref(false)
const fsSupported = ref(false)
const isFullscreen = ref(false)
function onFsChange() {
  isFullscreen.value = !!props.fullscreenTarget && document.fullscreenElement === props.fullscreenTarget
}
onMounted(() => {
  pipSupported.value = !!document.pictureInPictureEnabled
  fsSupported.value = !!document.fullscreenEnabled
  document.addEventListener('fullscreenchange', onFsChange)
})
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFsChange))

async function togglePip() {
  const v = el.value
  if (!v) return
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture()
    else await v.requestPictureInPicture()
  } catch {
    // Not available for this video (e.g. still loading) — nothing to do.
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await props.fullscreenTarget?.requestFullscreen()
  } catch {
    // Refused by the browser (e.g. not from a user action).
  }
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
function isEditable(t: HTMLElement | null) {
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}
let spaceHandled = false
function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (isEditable(t)) return
  // A focused slider (seek bar, trim handles) keeps its own arrow keys.
  const onSlider = t?.getAttribute?.('role') === 'slider'
  switch (e.code) {
    case 'Space':
      if (props.spaceTaken) return
      spaceHandled = true
      if (!e.repeat) togglePlay()
      break
    case 'KeyK':
      togglePlay()
      break
    case 'ArrowLeft':
    case 'ArrowRight':
      if (onSlider || props.arrowKeysTaken) return
      if (e.shiftKey) skip(e.code === 'ArrowLeft' ? -SHIFT_SKIP_SECONDS : SHIFT_SKIP_SECONDS)
      else step(e.code === 'ArrowLeft' ? -1 : 1)
      break
    case 'KeyJ':
      skip(-SHIFT_SKIP_SECONDS)
      break
    case 'KeyL':
      skip(SHIFT_SKIP_SECONDS)
      break
    case 'Home':
      if (onSlider) return
      stop()
      break
    case 'KeyF':
      toggleFullscreen()
      break
    default:
      return
  }
  e.preventDefault()
}
// Space on a focused button would click it on keyup — not after it played/paused.
function onKeyUp(e: KeyboardEvent) {
  if (e.code !== 'Space' || !spaceHandled) return
  spaceHandled = false
  e.preventDefault()
}
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

defineExpose({ togglePlay, stop, step, isFullscreen })
</script>
