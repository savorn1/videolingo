<template>
  <UModal
    v-model:open="open"
    title="Compare with the original"
    description="Both play together. Use the buttons to hear one or the other."
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div v-if="clip" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <figure v-for="side in SIDES" :key="side.key" class="space-y-1.5">
            <figcaption class="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
              <span>{{ side.label }}</span>
              <UBadge v-if="heard === side.key" size="sm" color="neutral" variant="subtle" icon="i-lucide-volume-2">Sound on</UBadge>
            </figcaption>
            <video
              :ref="(el) => (videos[side.key] = el as HTMLVideoElement | null)"
              :src="side.key === 'after' ? clip.url : originalUrl"
              class="aspect-video w-full rounded-lg bg-black object-contain"
              playsinline
              preload="metadata"
              :muted="heard !== side.key"
              @loadedmetadata="onLoaded"
            />
          </figure>
        </div>

        <div class="flex items-center gap-3">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
            :aria-label="playing ? 'Pause' : 'Play'"
            @click="toggle"
          >
            {{ playing ? 'Pause' : 'Play' }}
          </UButton>
          <USlider
            v-model="position"
            :min="0"
            :max="Math.max(length, 1)"
            :step="50"
            aria-label="Position"
            @update:model-value="(v: number | undefined) => seek(v ?? 0)"
          />
          <span class="w-24 shrink-0 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400"
            >{{ formatDuration(Math.round(position / 1000)) }} / {{ formatDuration(Math.round(length / 1000)) }}</span
          >
        </div>

        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Which sound to hear">
          <span class="text-xs text-gray-500 dark:text-gray-400">Hear</span>
          <UButton
            v-for="side in SIDES"
            :key="side.key"
            size="xs"
            color="neutral"
            :variant="heard === side.key ? 'soft' : 'ghost'"
            :aria-pressed="heard === side.key"
            @click="heard = side.key"
          >
            {{ side.label }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Plays a rendered result next to the video it came from, in step: one play button
// and one position control drive both. The original starts where the result starts
// (a trim or split result begins part-way into it; an audio or text edit begins at 0).
import type { VideoClip } from '~/composables/useVideoEdits'
import { formatDuration } from '#shared/utils/format'

const props = defineProps<{ clip: VideoClip | null; originalUrl: string }>()
const open = defineModel<boolean>('open', { default: false })

const SIDES = [
  { key: 'before', label: 'Original' },
  { key: 'after', label: 'Result' }
] as const
type Side = (typeof SIDES)[number]['key']

const videos = reactive<Record<Side, HTMLVideoElement | null>>({ before: null, after: null })
const heard = ref<Side>('after')
const playing = ref(false)
const position = ref(0)

const offsetMs = computed(() => (props.clip && (props.clip.operation === 'TRIM' || props.clip.operation === 'SPLIT') ? props.clip.startMs : 0))
const length = ref(0)

function onLoaded() {
  const after = videos.after
  if (after && Number.isFinite(after.duration)) length.value = Math.round(after.duration * 1000)
  seek(position.value)
}
function seek(ms: number) {
  if (videos.after) videos.after.currentTime = ms / 1000
  if (videos.before) videos.before.currentTime = (ms + offsetMs.value) / 1000
}
function toggle() {
  const all = [videos.before, videos.after].filter((v): v is HTMLVideoElement => !!v)
  if (playing.value) all.forEach((v) => v.pause())
  else all.forEach((v) => void v.play().catch(() => undefined))
  playing.value = !playing.value
}

// The result's clock drives the slider and keeps the original in step.
let timer: ReturnType<typeof setInterval> | undefined
watch(playing, (on) => {
  clearInterval(timer)
  if (!on) return
  timer = setInterval(() => {
    const after = videos.after
    const before = videos.before
    if (!after) return
    position.value = Math.round(after.currentTime * 1000)
    if (before && Math.abs(before.currentTime - (after.currentTime + offsetMs.value / 1000)) > 0.25)
      before.currentTime = after.currentTime + offsetMs.value / 1000
    if (after.ended) {
      playing.value = false
      before?.pause()
    }
  }, 200)
})
watch(open, (o) => {
  if (o) return
  playing.value = false
  position.value = 0
  length.value = 0
})
onBeforeUnmount(() => clearInterval(timer))
</script>
