<template>
  <div data-testid="audio-strip" class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 space-y-1 select-none">
    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span class="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
        <UIcon name="i-lucide-audio-lines" class="w-4 h-4" />
        Audio clips
      </span>
      <span
        >Drag a clip to move it · drag its edges to trim · click empty space to seek<template v-if="music">
          · drag the music to change when it starts</template
        ></span
      >
    </div>

    <!-- Ruler: click to seek; shows the selected range -->
    <div ref="ruler" class="relative h-5 cursor-pointer" data-testid="audio-ruler" @pointerdown="onRulerDown">
      <div
        v-if="edit.state.range[1] > edit.state.range[0]"
        class="absolute inset-y-0 rounded-sm bg-primary-500/15 border-x-2 border-primary-500"
        :style="{ left: pct(edit.state.range[0]), width: pct(edit.state.range[1] - edit.state.range[0]) }"
      />
      <div v-for="t in ticks" :key="t" class="absolute top-0 h-full border-l border-gray-300 dark:border-gray-700" :style="{ left: pct(t) }">
        <span v-if="t < durationMs * 0.95" class="absolute top-0 left-1 text-[10px] leading-none text-gray-500 tabular-nums dark:text-gray-400">{{
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

      <!-- Fades: the sound rising from silence and sinking back (drawn over the clips, not in the way of dragging) -->
      <div
        v-if="fades.fadeIn"
        class="absolute inset-y-0 z-10 pointer-events-none bg-linear-to-r from-gray-900/45 to-transparent dark:from-black/60"
        :style="{ left: pct(fades.fadeIn.startMs), width: pct(fades.fadeIn.endMs - fades.fadeIn.startMs) }"
        data-testid="fade-in"
        :title="`Fade in, ${formatTimecode(edit.state.fadeInMs)}`"
      >
        <svg class="absolute inset-0 h-full w-full text-white/80" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="currentColor" stroke-width="1.5"><line x1="0" y1="100" x2="100" y2="0" vector-effect="non-scaling-stroke" /></g>
        </svg>
      </div>
      <div
        v-if="fades.fadeOut"
        class="absolute inset-y-0 z-10 pointer-events-none bg-linear-to-l from-gray-900/45 to-transparent dark:from-black/60"
        :style="{ left: pct(fades.fadeOut.startMs), width: pct(fades.fadeOut.endMs - fades.fadeOut.startMs) }"
        data-testid="fade-out"
        :title="`Fade out, ${formatTimecode(edit.state.fadeOutMs)}`"
      >
        <svg class="absolute inset-0 h-full w-full text-white/80" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="currentColor" stroke-width="1.5"><line x1="0" y1="0" x2="100" y2="100" vector-effect="non-scaling-stroke" /></g>
        </svg>
      </div>

      <!-- Fade handles, as in audio editors: drag in from a top corner (or use ←/→) to set the fade -->
      <div
        v-for="h in fadeHandles"
        :key="h.edge"
        class="absolute top-0.5 z-30 size-3 -translate-x-1/2 rounded-full border-2 border-white bg-gray-700 shadow cursor-ew-resize focus-visible:outline-2 focus-visible:outline-primary-500 dark:bg-gray-300 dark:border-gray-900"
        :class="h.ms > 0 ? '' : 'opacity-60 hover:opacity-100'"
        :style="{ left: h.left }"
        role="slider"
        tabindex="0"
        :aria-label="h.edge === 'in' ? 'Fade in' : 'Fade out'"
        aria-valuemin="0"
        :aria-valuemax="MAX_FADE_MS / 1000"
        :aria-valuenow="h.ms / 1000"
        :aria-valuetext="`${(h.ms / 1000).toFixed(1)} s`"
        :title="`${h.edge === 'in' ? 'Fade in' : 'Fade out'}: ${(h.ms / 1000).toFixed(1)} s — drag to change`"
        :data-testid="`fade-${h.edge}-handle`"
        @pointerdown.stop="onFadeDown(h.edge, $event)"
        @keydown="onFadeKey(h.edge, $event)"
      />

      <p v-if="!edit.state.clips.length" class="absolute inset-0 flex items-center justify-center text-xs text-gray-500 pointer-events-none dark:text-gray-400">
        No clips — the sound is empty
      </p>

      <!-- Playhead -->
      <div class="absolute -top-6 bottom-0 w-px bg-error-500 pointer-events-none z-20" :style="{ left: pct(currentMs) }" />
    </div>

    <!-- Volume curve: click to add a point, drag one to move it, double-click (or Delete) to remove it -->
    <div
      ref="curveEl"
      class="relative h-12 rounded bg-gray-50 dark:bg-gray-800/60 cursor-crosshair"
      data-testid="volume-curve"
      title="Volume curve — click to add a point, drag to move, double-click to remove"
      @pointerdown.self="onCurveDown"
    >
      <span class="pointer-events-none absolute left-1 top-0.5 text-[10px] leading-none text-gray-500 dark:text-gray-400">
        Volume<template v-if="!curve.length"> — click to draw a curve</template>
      </span>
      <svg class="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
        <line
          x1="0"
          x2="1000"
          :y1="gainY(1)"
          :y2="gainY(1)"
          class="stroke-gray-300 dark:stroke-gray-600"
          stroke-dasharray="4 4"
          vector-effect="non-scaling-stroke"
        />
        <polyline
          v-if="curve.length"
          :points="curveLine"
          fill="none"
          class="stroke-primary-600 dark:stroke-primary-400"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div
        v-for="(p, i) in curve"
        :key="i"
        class="absolute z-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary-600 shadow cursor-move focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-gray-900 dark:bg-primary-400"
        :style="{ left: pct(p.atMs), top: `${gainY(p.gain)}%` }"
        role="slider"
        tabindex="0"
        :aria-label="`Volume point ${i + 1} at ${formatTimecode(p.atMs)}`"
        aria-valuemin="0"
        :aria-valuemax="MAX_CURVE_GAIN * 100"
        :aria-valuenow="Math.round(p.gain * 100)"
        :aria-valuetext="`${Math.round(p.gain * 100)}% at ${formatTimecode(p.atMs)}`"
        :title="`${Math.round(p.gain * 100)}% at ${formatTimecode(p.atMs)} — drag to move, double-click to remove`"
        data-testid="curve-point"
        @pointerdown.stop="onPointDown(i, $event)"
        @dblclick.stop="removePoint(i)"
        @keydown="onPointKey(i, $event)"
      />
      <div class="absolute inset-y-0 w-px bg-error-500 pointer-events-none z-20" :style="{ left: pct(currentMs) }" />
    </div>

    <!-- The music and each sound track: where it plays (each loop round marked); drag it, or use ←/→, to change when it starts -->
    <div
      v-for="(b, bi) in beds"
      :key="b.id"
      class="relative h-6 rounded bg-gray-50 dark:bg-gray-800/60 overflow-x-clip focus-visible:outline-2 focus-visible:outline-primary-500"
      role="slider"
      tabindex="0"
      :aria-label="`${b.isMusic ? 'Music' : `Sound track ${bi + (music ? 0 : 1)}`} start: ${b.bed.name}`"
      aria-valuemin="0"
      :aria-valuemax="Math.round(maxBedStart / 1000)"
      :aria-valuenow="Math.round(b.bed.startMs / 1000)"
      :aria-valuetext="formatTimecode(b.bed.startMs)"
      :data-testid="b.isMusic ? 'music-lane' : 'track-lane'"
      @keydown="(e) => onBedKey(b.bed, e)"
    >
      <div
        v-for="(sp, i) in b.rounds"
        :key="i"
        class="absolute inset-y-0.5 flex items-center overflow-hidden border-l-2 px-1.5 text-[11px] leading-none cursor-grab active:cursor-grabbing"
        :class="[b.isMusic ? BED_TONES.music : BED_TONES.track, i === 0 ? 'rounded-l-md' : 'border-dashed']"
        :style="{ left: pct(sp.startMs), width: pct(sp.endMs - sp.startMs) }"
        :title="i === 0 ? `${b.bed.name} — drag to change when it starts` : 'Loops round'"
        @pointerdown="(e) => onBedDown(b.bed, e)"
      >
        <span v-if="i === 0" class="flex items-center gap-1 truncate pointer-events-none">
          <UIcon :name="b.isMusic ? 'i-lucide-music' : 'i-lucide-audio-lines'" class="size-3 shrink-0" />{{ b.bed.name }}
        </span>
      </div>
      <div class="absolute inset-y-0 w-px bg-error-500 pointer-events-none z-20" :style="{ left: pct(currentMs) }" />
    </div>
  </div>
</template>

<script setup lang="ts">
// The audio edit's clips on the video's timeline (fit to width). Clips are
// pieces of the source sound: drag one to move it, drag its edges to trim.
// Drags snap to the playhead, the selected range and other clips' edges.
import type { AudioEdit, MusicSettings } from '~/composables/useAudioEdit'
import {
  addCurvePoint,
  assignLanes,
  clipEnd,
  clipLength,
  fadeFromHandle,
  fadeSpans,
  MAX_CURVE_GAIN,
  MAX_FADE_MS,
  moveCurvePoint,
  moveTo,
  musicSpans,
  trimEdges,
  type AudioClip
} from '#shared/utils/audioEdit'
import { formatTimecode } from '#shared/utils/transport'
import { snapMs } from '#shared/utils/timeline'

const props = defineProps<{ edit: AudioEdit; videoId: number; durationMs: number; currentMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const LANE_PX = 36
const SNAP_PX = 8

const ruler = useTemplateRef<HTMLDivElement>('ruler')
const lanesEl = useTemplateRef<HTMLDivElement>('lanesEl')
const curveEl = useTemplateRef<HTMLDivElement>('curveEl')
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

// ── Fades, background music and sound tracks ────────────────────────────────
const fades = computed(() => fadeSpans(props.edit.state, props.durationMs))
const music = computed(() => props.edit.state.music)
// Literal classes (Tailwind can't see built-up names): the music amber, the extra tracks teal.
const BED_TONES = {
  music: 'border-amber-600 bg-amber-400/70 text-amber-950 dark:border-amber-400 dark:bg-amber-500/50 dark:text-amber-50',
  track: 'border-teal-600 bg-teal-400/60 text-teal-950 dark:border-teal-400 dark:bg-teal-500/40 dark:text-teal-50'
}
/** The music, then each extra track, with where it plays. */
const beds = computed(() =>
  [
    ...(music.value ? [{ id: 'music', isMusic: true, bed: music.value }] : []),
    ...props.edit.state.tracks.map((t, i) => ({ id: `track${i}`, isMusic: false, bed: t }))
  ].map((b) => ({ ...b, rounds: musicSpans(b.bed, props.durationMs) }))
)
/** A bed has to start a little before the end, or nothing of it would be heard. */
const maxBedStart = computed(() => Math.max(0, props.durationMs - 100))
function setBedStart(bed: MusicSettings, ms: number) {
  bed.startMs = Math.round(Math.min(Math.max(0, ms), maxBedStart.value))
}
function onBedDown(bed: MusicSettings, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const row = (e.currentTarget as HTMLElement).parentElement
  row?.focus()
  const startX = e.clientX
  const startMs = bed.startMs
  const k = props.durationMs / Math.max(row?.clientWidth ?? 1, 1)
  const targets = snapTargets('')
  const move = (ev: PointerEvent) => setBedStart(bed, snapMs(startMs + (ev.clientX - startX) * k, targets, SNAP_PX * k))
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
/** ←/→ move the start by 0.1 s (Shift: 1 s); Home puts it at the beginning. */
function onBedKey(bed: MusicSettings, e: KeyboardEvent) {
  const step = e.shiftKey ? 1000 : 100
  if (e.key === 'ArrowLeft') setBedStart(bed, bed.startMs - step)
  else if (e.key === 'ArrowRight') setBedStart(bed, bed.startMs + step)
  else if (e.key === 'Home') setBedStart(bed, 0)
  else return
  e.preventDefault()
  e.stopPropagation()
}

// The fade handles sit where each fade ends, kept just inside the strip when there is no fade.
const fadeHandles = computed(() => [
  { edge: 'in' as const, ms: props.edit.state.fadeInMs, left: `max(6px, ${pct(fades.value.fadeIn?.endMs ?? 0)})` },
  { edge: 'out' as const, ms: props.edit.state.fadeOutMs, left: `min(calc(100% - 6px), ${pct(fades.value.fadeOut?.startMs ?? props.durationMs)})` }
])
function setFade(edge: 'in' | 'out', ms: number) {
  if (edge === 'in') props.edit.state.fadeInMs = ms
  else props.edit.state.fadeOutMs = ms
}
function onFadeDown(edge: 'in' | 'out', e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).focus()
  const move = (ev: PointerEvent) => setFade(edge, fadeFromHandle(edge, msAt(ev.clientX, lanesEl.value), props.edit.state, props.durationMs))
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
/** ←/→ lengthen or shorten the fade by 0.1 s (Shift: 1 s), the arrow pointing the way the handle moves. */
function onFadeKey(edge: 'in' | 'out', e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  e.stopPropagation()
  const s = props.edit.state
  const speed = s.speed > 0 ? s.speed : 1
  const step = (e.shiftKey ? 1000 : 100) * (e.key === 'ArrowRight' ? 1 : -1)
  // Where the handle is now on the video's timeline, moved by the step on the finished one.
  const at = edge === 'in' ? s.fadeInMs * speed : props.durationMs - s.fadeOutMs * speed
  setFade(edge, fadeFromHandle(edge, at + step * speed, s, props.durationMs))
}

// ── Volume curve ────────────────────────────────────────────────────────────
const curve = computed(() => props.edit.state.volumeCurve)
/** A level's height in the lane, 0 % at the bottom and MAX_CURVE_GAIN at the top (in % of the lane, a little inset). */
function gainY(gain: number) {
  return 92 - (gain / MAX_CURVE_GAIN) * 84
}
function gainAt(clientY: number) {
  const r = curveEl.value!.getBoundingClientRect()
  const y = ((clientY - r.top) / r.height) * 100
  return ((92 - y) / 84) * MAX_CURVE_GAIN
}
/** The line across the whole lane: flat before the first point and after the last. */
const curveLine = computed(() => {
  const pts = curve.value
  if (!pts.length) return ''
  const x = (ms: number) => (Math.max(0, ms) / Math.max(props.durationMs, 1)) * 1000
  return [`0,${gainY(pts[0]!.gain)}`, ...pts.map((p) => `${x(p.atMs)},${gainY(p.gain)}`), `1000,${gainY(pts[pts.length - 1]!.gain)}`].join(' ')
})
function onCurveDown(e: PointerEvent) {
  if (e.button !== 0) return
  const s = props.edit.state
  const at = msAt(e.clientX, curveEl.value)
  s.volumeCurve = addCurvePoint(s.volumeCurve, at, gainAt(e.clientY), props.durationMs)
  // Carry on as a drag of the new point.
  const i = s.volumeCurve.findIndex((p) => Math.abs(p.atMs - Math.round(at)) < 1)
  if (i >= 0) onPointDown(i, e)
}
function onPointDown(i: number, e: PointerEvent) {
  if (e.button !== 0) return
  e.preventDefault()
  const s = props.edit.state
  const move = (ev: PointerEvent) => {
    s.volumeCurve = moveCurvePoint(s.volumeCurve, i, msAt(ev.clientX, curveEl.value), gainAt(ev.clientY), props.durationMs)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
function removePoint(i: number) {
  props.edit.state.volumeCurve = props.edit.state.volumeCurve.filter((_, j) => j !== i)
}
/** ↑/↓ the level by 5 % (Shift: 25 %), ←/→ the time by 0.1 s (Shift: 1 s), Delete/Backspace removes it. */
function onPointKey(i: number, e: KeyboardEvent) {
  const s = props.edit.state
  const p = s.volumeCurve[i]
  if (!p) return
  const big = e.shiftKey
  if (e.key === 'Delete' || e.key === 'Backspace') removePoint(i)
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    s.volumeCurve = moveCurvePoint(s.volumeCurve, i, p.atMs, p.gain + (big ? 0.25 : 0.05) * (e.key === 'ArrowUp' ? 1 : -1), props.durationMs)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    s.volumeCurve = moveCurvePoint(s.volumeCurve, i, p.atMs + (big ? 1000 : 100) * (e.key === 'ArrowRight' ? 1 : -1), p.gain, props.durationMs)
  else return
  e.preventDefault()
  e.stopPropagation()
}
</script>
