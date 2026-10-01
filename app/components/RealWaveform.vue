<template>
  <svg viewBox="0 0 100 25" :preserveAspectRatio="mini ? 'xMidYMid meet' : 'none'" class="overflow-hidden" aria-hidden="true">
    <template v-if="kind === 'WAVES'">
      <polyline :points="wavePoints" fill="none" :stroke="color" stroke-width="0.8" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </template>
    <template v-else-if="kind === 'SPIKES'">
      <line
        v-for="(v, i) in cols"
        :key="i"
        :x1="i * 2 + 1"
        :x2="i * 2 + 1"
        :y1="12.5"
        :y2="12.5 - v * 12"
        :stroke="color"
        stroke-width="0.9"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </template>
    <template v-else-if="kind === 'DOTS'">
      <circle v-for="(v, i) in cols" :key="i" :cx="i * 3 + 1.5" :cy="12.5 - v * 11" r="0.9" :fill="color" />
    </template>
    <template v-else>
      <rect
        v-for="(v, i) in cols"
        :key="i"
        :x="2 + i * layout.pitch"
        :y="12.5 - barHeight(v) / 2"
        :width="layout.bar"
        :height="barHeight(v)"
        :rx="layout.bar / 2.2"
        :fill="color"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
// The waveform sketch drawn from the user's own sound instead of a made-up shape: it steps through
// the first seconds of the audio at the server's frame rate and loops. Still (one frame) when asked
// to stand still or when the system asks for less motion.
import { COLUMNS, PREVIEW_SECONDS, WAVE_FPS, barHeight, frameColumns, loopTime, type RealStyle } from '#shared/utils/waveSamples'
import type { AudioPeaks } from '~/composables/useAudioPeaks'

const props = defineProps<{ kind: RealStyle; color: string; audio: AudioPeaks; mini?: boolean; still?: boolean }>()

// How the mirrored bar styles are spaced in the 100-wide sketch (same as WaveformPreview's sketches).
const LAYOUTS: Partial<Record<RealStyle, { pitch: number; bar: number }>> = {
  PULSE: { pitch: 2.35, bar: 0.9 },
  BLOCKS: { pitch: 5.4, bar: 3.2 },
  FINE: { pitch: 1.5, bar: 0.5 },
  STRIPES: { pitch: 3.5, bar: 1.7 }
}
const layout = computed(() => LAYOUTS[props.kind] ?? { pitch: 2, bar: 1 })

const { speed } = useAnimationSpeed()
const time = ref(0)
const cols = computed(() => frameColumns(props.audio.samples, props.audio.sampleRate, time.value, COLUMNS[props.kind]))
const wavePoints = computed(() => cols.value.map((v, i) => `${i},${12.5 - v * 11}`).join(' '))

let raf = 0
let last = 0
let elapsed = 0
const reduced = import.meta.client && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const lengthSec = computed(() => Math.min(PREVIEW_SECONDS, props.audio.samples.length / props.audio.sampleRate))

function tick(now: number) {
  raf = requestAnimationFrame(tick)
  if (!last) last = now
  const dt = (now - last) / 1000
  if (dt < 1 / WAVE_FPS) return
  last = now
  elapsed += dt * speed.value
  time.value = loopTime(elapsed, lengthSec.value)
}
function start() {
  stop()
  if (props.still || reduced) {
    time.value = Math.min(1, lengthSec.value / 3)
    return
  }
  last = 0
  raf = requestAnimationFrame(tick)
}
function stop() {
  cancelAnimationFrame(raf)
}
onMounted(start)
watch(() => [props.still, props.audio], start)
onBeforeUnmount(stop)
</script>
