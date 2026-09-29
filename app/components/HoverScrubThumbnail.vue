<template>
  <div class="relative w-full h-full" @pointerenter="onEnter" @pointerleave="onLeave">
    <img
      v-if="thumbnailUrl && !broken"
      :src="thumbnailUrl"
      :alt="alt ?? ''"
      loading="lazy"
      class="w-full h-full object-cover"
      @error="broken = true"
    />
    <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-5 h-5 text-gray-400" />

    <!-- Mounted only on hover: no cost for the dozens of thumbnails not being looked at. -->
    <video
      v-if="showVideo && videoUrl"
      ref="videoEl"
      :src="videoUrl"
      class="absolute inset-0 w-full h-full object-cover transition-opacity duration-150"
      :class="frameReady ? 'opacity-100' : 'opacity-0'"
      muted
      playsinline
      preload="metadata"
      @loadedmetadata="onMeta"
      @seeked="frameReady = true"
    />

    <span
      v-if="durationSeconds != null"
      class="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] font-semibold text-white tabular-nums"
    >
      {{ formatDuration(durationSeconds) }}
    </span>
  </div>
</template>

<script setup lang="ts">
// A static thumbnail that scrubs through a few real frames on hover — the
// video itself is only fetched (metadata + the handful of frames scrubbed
// to) once someone's actually pointing at it, never up front for a whole
// list. Falls back to just the static image when there's no `videoUrl` (a
// link video with a thumbnail but nothing to scrub) or it fails to load.
const props = defineProps<{
  thumbnailUrl?: string | null
  videoUrl?: string | null
  durationSeconds?: number | null
  alt?: string
}>()

const broken = ref(false)
const showVideo = ref(false)
const frameReady = ref(false)
const videoEl = useTemplateRef<HTMLVideoElement>('videoEl')

/** Fractions of the duration to cycle through — spread across the video, not clustered near the start. */
const POSITIONS = [0.15, 0.35, 0.55, 0.75, 0.92]
/** Used until real metadata arrives, or when the duration is unknown — short, safe offsets. */
const FALLBACK_SECONDS = [2, 5, 9, 14]

let enterTimer: ReturnType<typeof setTimeout> | undefined
let cycleTimer: ReturnType<typeof setInterval> | undefined
let index = 0

function seekTo(seconds: number) {
  const el = videoEl.value
  if (!el || !Number.isFinite(seconds)) return
  frameReady.value = false
  el.currentTime = seconds
}

function onMeta() {
  const el = videoEl.value
  if (el && Number.isFinite(el.duration) && el.duration > 0) seekTo(POSITIONS[index % POSITIONS.length]! * el.duration)
}

function tick() {
  index++
  const el = videoEl.value
  if (el && Number.isFinite(el.duration) && el.duration > 0) seekTo(POSITIONS[index % POSITIONS.length]! * el.duration)
  else seekTo(FALLBACK_SECONDS[index % FALLBACK_SECONDS.length]!)
}

function onEnter() {
  if (!props.videoUrl || broken.value) return
  // A short delay: moving the pointer across a row of thumbnails shouldn't fetch every one it passes over.
  enterTimer = setTimeout(() => {
    index = 0
    frameReady.value = false
    showVideo.value = true
    cycleTimer = setInterval(tick, 750)
  }, 200)
}

function onLeave() {
  clearTimeout(enterTimer)
  clearInterval(cycleTimer)
  showVideo.value = false
  frameReady.value = false
}

onBeforeUnmount(() => {
  clearTimeout(enterTimer)
  clearInterval(cycleTimer)
})
</script>
