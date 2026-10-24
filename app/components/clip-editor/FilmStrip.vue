<template>
  <div class="relative overflow-hidden rounded-md bg-gray-900" data-testid="film-strip">
    <div class="flex h-10 sm:h-12">
      <button
        v-for="(t, i) in times"
        :key="i"
        type="button"
        class="relative h-full min-w-0 flex-1 border-r border-black/40 last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
        :aria-label="`Go to ${formatTimecode(t)}`"
        @click="emit('seek', t)"
      >
        <canvas :ref="(el) => (canvases[i] = el as HTMLCanvasElement | null)" class="h-full w-full object-cover" :width="FRAME_W" :height="FRAME_H" />
      </button>
    </div>
    <!-- The sound under the frames: the gaps are the pauses -->
    <canvas v-show="hasWave" ref="waveCanvas" class="block h-5 w-full" :width="WAVE_COLUMNS * 3" height="40" data-testid="film-strip-wave" aria-hidden="true" />
    <!-- What the trim leaves out is dimmed -->
    <div class="pointer-events-none absolute inset-y-0 left-0 bg-black/60" :style="{ width: `${pct(range[0])}%` }" />
    <div class="pointer-events-none absolute inset-y-0 right-0 bg-black/60" :style="{ width: `${100 - pct(range[1])}%` }" />
  </div>
</template>

<script setup lang="ts">
// A row of frames along the Trim tab's timeline, to find a scene change by eye; a click goes there. The frames are
// drawn in the browser from a second, hidden copy of the video (only shown, never read back, so no CORS is needed).
import { filmstripTimes, peakColumns } from '#shared/utils/filmstrip'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ videoUrl: string; videoId: number; durationMs: number; range: [number, number] }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const FRAMES = 12
const FRAME_W = 160
const FRAME_H = 90
const times = computed(() => filmstripTimes(props.durationMs, FRAMES))
const canvases: (HTMLCanvasElement | null)[] = []
const pct = (ms: number) => (props.durationMs ? Math.min(100, Math.max(0, (ms / props.durationMs) * 100)) : 0)

let run = 0
async function draw() {
  const mine = ++run
  if (!props.videoUrl || !times.value.length) return
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = props.videoUrl
  const ready = await new Promise<boolean>((resolve) => {
    video.addEventListener('loadeddata', () => resolve(true), { once: true })
    video.addEventListener('error', () => resolve(false), { once: true })
  })
  for (const [i, t] of times.value.entries()) {
    if (!ready || mine !== run) break
    const seeked = new Promise<void>((resolve) => video.addEventListener('seeked', () => resolve(), { once: true }))
    video.currentTime = t / 1000
    await seeked
    const canvas = canvases[i]
    if (mine !== run || !canvas || !video.videoWidth) continue
    // Cover the frame's box, as object-cover would.
    const scale = Math.max(FRAME_W / video.videoWidth, FRAME_H / video.videoHeight)
    const w = video.videoWidth * scale
    const h = video.videoHeight * scale
    canvas.getContext('2d')?.drawImage(video, (FRAME_W - w) / 2, (FRAME_H - h) / 2, w, h)
  }
  video.removeAttribute('src')
  video.load()
}
// ── The waveform: the server's peaks (the same as the Audio tab's), as columns ──
const WAVE_COLUMNS = 240
const waveCanvas = ref<HTMLCanvasElement | null>(null)
const hasWave = ref(false)
const { waveform } = useVideoEdits()
async function drawWave() {
  try {
    const { peaks } = await waveform(props.videoId, { points: 1200 })
    const canvas = waveCanvas.value
    const columns = peakColumns(peaks, WAVE_COLUMNS)
    if (!canvas || !columns.length) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#38bdf8'
    columns.forEach((v, i) => {
      const h = Math.max(1, Math.round(v * canvas.height))
      ctx.fillRect(i * 3, (canvas.height - h) / 2, 2, h)
    })
    hasWave.value = true
  } catch {
    // No sound (or no file to read): the frames are enough.
    hasWave.value = false
  }
}

onMounted(() => {
  draw()
  drawWave()
})
watch(() => [props.videoUrl, props.durationMs], draw)
onBeforeUnmount(() => run++)
</script>
