<template>
  <div data-testid="audio-strip" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 space-y-1 select-none">
    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span class="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
        <UIcon name="i-lucide-audio-lines" class="w-4 h-4" />
        Audio clips
      </span>
      <span>Drag a clip to move it · drag its edges to trim · click empty space to seek</span>
    </div>

    <!-- Ruler: click to seek; shows the selected range -->
    <div ref="ruler" class="relative h-5 cursor-pointer" data-testid="audio-ruler" @pointerdown="onRulerDown">
      <div
        v-if="edit.state.range[1] > edit.state.range[0]"
        class="absolute inset-y-0 rounded-sm bg-primary-500/15 border-x-2 border-primary-500"
        :style="{ left: pct(edit.state.range[0]), width: pct(edit.state.range[1] - edit.state.range[0]) }"
      />
      <div v-for="t in ticks" :key="t" class="absolute top-0 h-full border-l border-gray-300 dark:border-gray-700" :style="{ left: pct(t) }">
        <span v-if="t < durationMs * 0.95" class="absolute top-0 left-1 text-[10px] leading-none text-gray-400 tabular-nums">{{
          formatDuration(Math.round(t / 1000))
        }}</span>
      </div>
    </div>

    <!-- Lanes -->
    <div
      ref="lanesEl"
      class="relative rounded bg-gray-50 dark:bg-gray-800/60 overflow-x-clip"
      :style="{ height: `${laneCount * LANE_PX}px` }"
      @pointerdown.self="onEmptyDown"
    >
      <!-- Muted ranges -->
      <div
        v-for="(m, i) in edit.state.mutes"
        :key="`m${i}`"
        class="absolute inset-y-0 pointer-events-none bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.25)_0_6px,transparent_6px_12px)] border-x border-error-500/60"
        :style="{ left: pct(m.startMs), width: pct(m.endMs - m.startMs) }"
        :title="`Muted ${formatTimecode(m.startMs)} – ${formatTimecode(m.endMs)}`"
      />

      <div
        v-for="c in edit.state.clips"
        :key="c.id"
        data-testid="audio-clip"
        :data-clip-id="c.id"
        class="absolute rounded-md overflow-hidden text-[11px] leading-tight text-white cursor-grab active:cursor-grabbing"
        :class="c.id === edit.state.selectedId ? 'bg-primary-600 ring-2 ring-primary-300 dark:ring-primary-400 z-10' : 'bg-primary-500/80 hover:bg-primary-500'"
        :style="{ left: pct(c.atMs), width: pct(visibleEnd(c) - c.atMs), top: `${(lanes.get(c.id) ?? 0) * LANE_PX + 3}px`, height: `${LANE_PX - 6}px` }"
        @pointerdown.stop="onClipDown(c, 'move', $event)"
      >
        <svg
          v-if="wave"
          class="absolute inset-0 h-full w-full pointer-events-none text-white/45"
          :viewBox="`0 0 ${clipWave(c).length || 1} 100`"
          preserveAspectRatio="none"
          aria-hidden="true"
          data-testid="clip-waveform"
        >
          <path :d="wavePath(clipWave(c))" stroke="currentColor" stroke-width="1" fill="none" />
        </svg>
        <div class="relative px-2 pt-1 truncate pointer-events-none">
          {{ formatTimecode(c.srcStartMs) }}–{{ formatTimecode(c.srcEndMs) }}
          <span v-if="c.gain !== 1" class="opacity-80">· {{ Math.round(c.gain * 100) }}%</span>
        </div>
        <div
          class="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
          aria-label="Trim start"
          @pointerdown.stop="onClipDown(c, 'start', $event)"
        />
        <div
          class="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
          aria-label="Trim end"
          @pointerdown.stop="onClipDown(c, 'end', $event)"
        />
      </div>

      <p v-if="!edit.state.clips.length" class="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">
        No clips — the sound is empty
      </p>

      <!-- Playhead -->
      <div class="absolute -top-6 bottom-0 w-px bg-error-500 pointer-events-none z-20" :style="{ left: pct(currentMs) }" />
    </div>
  </div>
</template>

<script setup lang="ts">
// The audio edit's clips on the video's timeline (fit to width). Clips are
// pieces of the source sound: drag one to move it, drag its edges to trim.
// Drags snap to the playhead, the selected range and other clips' edges.
import type { AudioEdit } from '~/composables/useAudioEdit'
import { assignLanes, clipEnd, clipLength, moveTo, trimEdges, type AudioClip } from '#shared/utils/audioEdit'
import { formatTimecode } from '#shared/utils/transport'
import { snapMs } from '#shared/utils/timeline'

const props = defineProps<{ edit: AudioEdit; videoId: number; durationMs: number; currentMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const LANE_PX = 36
const SNAP_PX = 8

const ruler = useTemplateRef<HTMLDivElement>('ruler')
const lanesEl = useTemplateRef<HTMLDivElement>('lanesEl')
const lanes = computed(() => assignLanes(props.edit.state.clips))
const laneCount = computed(() => Math.max(1, ...[...lanes.value.values()].map((l) => l + 1)))

function pct(ms: number) {
  return `${(Math.max(0, ms) / Math.max(props.durationMs, 1)) * 100}%`
}

// A tick every 1/2/5/10/… seconds, about 8 across.
const ticks = computed(() => {
  const d = props.durationMs
  if (!d) return []
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600].map((s) => s * 1000)
  const step = steps.find((s) => d / s <= 8) ?? steps[steps.length - 1]!
  return Array.from({ length: Math.floor(d / step) + 1 }, (_, i) => i * step)
})

// A clip running past the end of the video is cut there when rendered — and drawn that way.
function visibleEnd(c: AudioClip) {
  return Math.min(clipEnd(c), props.durationMs)
}

// ── Waveform ─────────────────────────────────────────────────────────────────
// Peaks of the sound clips are cut from (the video's, or the replacement
// file's), fetched from the server — which reads our own storage, so no
// browser access to the media is needed.
const { waveform } = useVideoEdits()
const wave = ref<{ durationMs: number; peaks: number[] } | null>(null)
const sourceKey = computed(() => (props.edit.state.source === 'UPLOAD' ? (props.edit.state.replacement?.key ?? null) : null))
watch(
  sourceKey,
  async (key) => {
    wave.value = null
    try {
      const w = await waveform(props.videoId, { key, points: 3000 })
      if (key === sourceKey.value && w.peaks.length) wave.value = w
    } catch {
      // No waveform (e.g. no sound, or a link video): the clips are still usable.
    }
  },
  { immediate: true }
)

/** The clip's own stretch of the peaks, at most ~600 bars. */
function clipWave(c: AudioClip) {
  const w = wave.value
  if (!w || !w.durationMs) return []
  const n = w.peaks.length
  const a = Math.max(0, Math.floor((c.srcStartMs / w.durationMs) * n))
  const b = Math.min(n, Math.ceil((c.srcEndMs / w.durationMs) * n))
  const slice = w.peaks.slice(a, b)
  const stride = Math.max(1, Math.ceil(slice.length / 600))
  const out: number[] = []
  for (let i = 0; i < slice.length; i += stride) out.push(Math.max(...slice.slice(i, i + stride)) * c.gain)
  return out
}

function wavePath(peaks: number[]) {
  return peaks
    .map((p, i) => {
      const h = Math.min(96, Math.max(2, p * 96))
      return `M${i + 0.5} ${50 - h / 2}V${50 + h / 2}`
    })
    .join('')
}

function msPerPx() {
  const w = lanesEl.value?.clientWidth ?? 1
  return props.durationMs / Math.max(w, 1)
}
function msAt(clientX: number, el: HTMLElement | null) {
  const r = el!.getBoundingClientRect()
  return Math.min(Math.max(0, ((clientX - r.left) / r.width) * props.durationMs), props.durationMs)
}

function seekFrom(e: PointerEvent, el: HTMLElement | null) {
  emit('seek', Math.round(msAt(e.clientX, el)))
}
function onRulerDown(e: PointerEvent) {
  seekFrom(e, ruler.value)
  const move = (ev: PointerEvent) => seekFrom(ev, ruler.value)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
function onEmptyDown(e: PointerEvent) {
  props.edit.state.selectedId = null
  seekFrom(e, lanesEl.value)
}

function snapTargets(except: string) {
  const t = [0, props.durationMs, props.currentMs, ...props.edit.state.range]
  for (const c of props.edit.state.clips) {
    if (c.id !== except) t.push(c.atMs, clipEnd(c))
  }
  return t
}

// One drag at a time: move the clip, or trim one of its edges.
function onClipDown(c: AudioClip, what: 'move' | 'start' | 'end', e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const state = props.edit.state
  state.selectedId = c.id
  const start = { x: e.clientX, clip: { ...c } }
  const k = msPerPx()
  const tolerance = SNAP_PX * k
  const targets = snapTargets(c.id)
  const len = clipLength(start.clip)

  const move = (ev: PointerEvent) => {
    const dMs = (ev.clientX - start.x) * k
    if (what === 'move') {
      // Snap whichever edge is closer to something.
      let at = start.clip.atMs + dMs
      const snappedStart = snapMs(at, targets, tolerance)
      const snappedEnd = snapMs(at + len, targets, tolerance)
      if (snappedStart !== at) at = snappedStart
      else if (snappedEnd !== at + len) at = snappedEnd - len
      state.clips = moveTo(state.clips, c.id, at, props.durationMs)
    } else if (what === 'start') {
      state.clips = trimEdges(state.clips, c.id, { startMs: snapMs(start.clip.atMs + dMs, targets, tolerance) }, props.edit.sourceMs.value)
    } else {
      // From the edge as drawn: a clip running past the end starts at the video's end.
      state.clips = trimEdges(state.clips, c.id, { endMs: snapMs(visibleEnd(start.clip) + dMs, targets, tolerance) }, props.edit.sourceMs.value)
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
</script>
