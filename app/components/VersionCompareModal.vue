<template>
  <UModal :open="!!version" title="Compare versions" :ui="{ content: 'sm:max-w-3xl' }" @update:open="(v: boolean) => !v && emit('close')">
    <template #body>
      <div v-if="version" class="space-y-3">
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Older · {{ version.note ?? 'Prior version' }}</span>
          <span>Current · {{ currentLabel }}</span>
        </div>

        <!-- Two videos stacked exactly; the wipe slider clips the top (current) one. -->
        <div ref="stage" class="relative w-full aspect-video overflow-hidden rounded-lg bg-black select-none" data-testid="compare-stage" @pointerdown="onDrag">
          <video ref="oldEl" :src="version.url" class="absolute inset-0 w-full h-full object-contain" playsinline muted />
          <div class="absolute inset-0 overflow-hidden" :style="{ clipPath: `inset(0 ${100 - wipe}% 0 0)` }">
            <video ref="newEl" :src="currentUrl" class="absolute inset-0 w-full h-full object-contain" playsinline muted />
          </div>
          <div class="absolute inset-y-0 w-0.5 bg-white pointer-events-none" :style="{ left: `${wipe}%` }">
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow">
              <UIcon name="i-lucide-move-horizontal" class="w-4 h-4 text-gray-700" />
            </div>
          </div>
          <span class="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">Older</span>
          <span class="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">Current</span>
        </div>

        <div class="flex items-center gap-2">
          <UButton size="sm" :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay" />
          <USlider
            :model-value="[Math.round(timeMs)]"
            :min="0"
            :max="Math.max(durationMs, 1)"
            :step="50"
            class="flex-1"
            aria-label="Seek"
            @update:model-value="(v) => seek(v?.[0] ?? 0)"
          />
          <span class="text-xs tabular-nums text-gray-500 w-28 text-right">{{ formatTimecode(timeMs) }} / {{ formatTimecode(durationMs) }}</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">Drag the handle (or the video) to reveal more of either side — both play in sync.</p>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// A synced side-by-side (wipe) comparison of a prior version against the
// video's current file: both <video> elements share one seek/play, and a
// draggable divider shows the older file on the left, the current one on
// the right, of the same frame.
import type { VideoVersion } from '~/composables/useVideoVersions'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ version: VideoVersion | null; currentUrl: string; currentLabel: string }>()
const emit = defineEmits<{ close: [] }>()

const stage = useTemplateRef<HTMLDivElement>('stage')
const oldEl = useTemplateRef<HTMLVideoElement>('oldEl')
const newEl = useTemplateRef<HTMLVideoElement>('newEl')
const wipe = ref(50)
const playing = ref(false)
const timeMs = ref(0)
const durationMs = ref(0)

function bothVideos() {
  return [oldEl.value, newEl.value].filter((v): v is HTMLVideoElement => !!v)
}

function togglePlay() {
  const [a] = bothVideos()
  if (!a) return
  if (a.paused) bothVideos().forEach((v) => v.play().catch(() => {}))
  else bothVideos().forEach((v) => v.pause())
}
function seek(ms: number) {
  bothVideos().forEach((v) => (v.currentTime = ms / 1000))
  timeMs.value = ms
}

watch(
  () => props.version,
  (v, _old, onCleanup) => {
    if (!v) return
    wipe.value = 50
    timeMs.value = 0
    durationMs.value = 0
    playing.value = false
    nextTick(() => {
      const els = bothVideos()
      const onPlay = () => (playing.value = true)
      const onPause = () => (playing.value = false)
      const onTime = () => (timeMs.value = (oldEl.value?.currentTime ?? 0) * 1000)
      const onMeta = () => (durationMs.value = Math.max(durationMs.value, (oldEl.value?.duration || 0) * 1000, (newEl.value?.duration || 0) * 1000))
      for (const el of els) {
        el.addEventListener('play', onPlay)
        el.addEventListener('pause', onPause)
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('loadedmetadata', onMeta)
      }
      onCleanup(() => {
        for (const el of els) {
          el.removeEventListener('play', onPlay)
          el.removeEventListener('pause', onPause)
          el.removeEventListener('timeupdate', onTime)
          el.removeEventListener('loadedmetadata', onMeta)
        }
      })
    })
  },
  { immediate: true }
)
onBeforeUnmount(() => bothVideos().forEach((v) => v.pause()))

function wipeAt(clientX: number) {
  const r = stage.value!.getBoundingClientRect()
  wipe.value = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))
}
function onDrag(e: PointerEvent) {
  wipeAt(e.clientX)
  const move = (ev: PointerEvent) => wipeAt(ev.clientX)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true })
}
</script>
