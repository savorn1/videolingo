<template>
  <div class="space-y-3">
    <div class="relative aspect-video rounded-md bg-black overflow-hidden">
      <video
        ref="videoEl"
        :key="src"
        :src="src"
        :crossorigin="remote ? 'anonymous' : undefined"
        class="w-full h-full object-contain"
        preload="auto"
        muted
        playsinline
        @loadedmetadata="onLoaded"
        @seeking="seeking = true"
        @seeked="seeking = false"
        @error="loadError = true"
      />
      <div v-if="!ready && !loadError" class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
      </div>
      <div v-if="loadError" class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-300">
        This video can’t be read here, so a frame can’t be picked from it.
      </div>
    </div>

    <template v-if="ready">
      <USlider v-model="time" :min="0" :max="duration" :step="0.1" aria-label="Frame time" />
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="timeText"
          class="w-28"
          icon="i-lucide-clock"
          placeholder="m:ss"
          aria-label="Frame time (m:ss)"
          @keydown.enter.prevent="applyTimeText"
          @blur="applyTimeText"
        />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-left" aria-label="Back one second" @click="nudge(-1)" />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-chevron-right" aria-label="Forward one second" @click="nudge(1)" />
        <span class="text-xs text-gray-500">of {{ formatDuration(duration) }}</span>
        <UButton class="ms-auto" size="xs" icon="i-lucide-camera" :loading="saving" :disabled="seeking" @click="useFrame"> Use this frame </UButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Scrub through a video and save the frame showing as its thumbnail. Frames are
// drawn in the browser, so a remote file must allow cross-origin reads
// (our MinIO/S3 bucket does).
const props = defineProps<{
  src: string
  /** Where to start, e.g. the moment the current thumbnail was taken from. */
  initialSeconds?: number
}>()
const emit = defineEmits<{ picked: [url: string] }>()

const videos = useVideos()
const toast = useToast()

const videoEl = ref<HTMLVideoElement | null>(null)
const ready = ref(false)
const loadError = ref(false)
const seeking = ref(false)
const saving = ref(false)
const duration = ref(0)
const time = ref(0)
const timeText = ref('0:00')

const remote = computed(() => /^https?:/i.test(props.src))

watch(
  () => props.src,
  () => {
    ready.value = false
    loadError.value = false
  }
)

function onLoaded() {
  const d = videoEl.value?.duration ?? 0
  duration.value = Number.isFinite(d) && d > 0 ? d : 0
  // Past a black intro frame by default, like the automatic thumbnail.
  time.value = Math.min(props.initialSeconds ?? Math.min(3, duration.value * 0.1), duration.value)
  ready.value = duration.value > 0
  if (!ready.value) loadError.value = true
}

watch(time, (t) => {
  timeText.value = formatDuration(Math.floor(t))
  if (videoEl.value && Math.abs(videoEl.value.currentTime - t) > 0.05) videoEl.value.currentTime = t
})

function applyTimeText() {
  const seconds = parseDurationInput(timeText.value)
  if (seconds === null) {
    timeText.value = formatDuration(Math.floor(time.value))
    return
  }
  time.value = Math.min(seconds, duration.value)
}

function nudge(by: number) {
  time.value = Math.max(0, Math.min(duration.value, time.value + by))
}

async function useFrame() {
  const el = videoEl.value
  if (!el) return
  saving.value = true
  try {
    let blob: Blob
    try {
      blob = await captureFrame(el)
    } catch {
      throw new Error('The site hosting this file doesn’t allow its frames to be captured — paste a thumbnail address instead.')
    }
    const ticket = await videos.requestUpload('THUMBNAIL', { name: 'thumbnail.jpg', type: 'image/jpeg', size: blob.size })
    await uploadToStorage(ticket, blob)
    emit('picked', ticket.publicUrl)
  } catch (err) {
    toast.add({ title: 'Couldn’t save the thumbnail', description: err instanceof Error ? err.message : apiErrorMessage(err), color: 'warning' })
  } finally {
    saving.value = false
  }
}
</script>
