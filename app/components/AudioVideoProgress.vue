<template>
  <UAlert
    v-if="job && (active || job.status === 'FAILED')"
    class="mb-4"
    :color="active ? 'info' : 'error'"
    variant="subtle"
    :icon="active ? 'i-lucide-loader' : 'i-lucide-triangle-alert'"
    :title="active ? 'Making the video from the audio' : 'The video could not be made'"
    :description="active ? undefined : (job.errorMessage ?? 'Something went wrong.')"
    data-testid="audio-video-progress"
  >
    <template v-if="active" #description>
      <JobProgress :status="job.status" :progress="job.progress" :current-step="job.currentStep" :queue-position="job.queuePosition" size="lg" class="mt-1" />
      <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">You can leave this page; the video keeps being made. It stays hidden until you enable it.</p>
    </template>
    <template #actions>
      <UButton size="xs" color="neutral" variant="soft" :to="`/processing-jobs/${job.id}`">View job</UButton>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
// On a video that is being made from audio: shows the job's progress, and tells
// the page when it has finished so the page can load the finished video. Shows
// nothing for any other video, or once the job is done.
import { findAudioVideoJob } from '#shared/utils/audioVideo'
import { isActiveJobStatus } from '#shared/utils/processingJobs'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

const props = defineProps<{ videoId: number }>()
const emit = defineEmits<{ finished: [] }>()

const { overview } = useVideoEdits()
const job = ref<ProcessingJob | null>(null)
const active = computed(() => !!job.value && isActiveJobStatus(job.value.status))

let timer: ReturnType<typeof setInterval> | undefined
async function refresh() {
  try {
    const before = job.value
    job.value = findAudioVideoJob((await overview(props.videoId)).jobs)
    // It was running a moment ago and isn't now: the video's file has changed.
    if (before && isActiveJobStatus(before.status) && job.value && !isActiveJobStatus(job.value.status)) emit('finished')
  } catch {
    // The banner is a convenience; the page works without it.
  }
}

watch(
  active,
  (isActive) => {
    clearInterval(timer)
    if (isActive) timer = setInterval(refresh, 3000)
  },
  { immediate: true }
)
onMounted(refresh)
onBeforeUnmount(() => clearInterval(timer))
watch(() => props.videoId, refresh)
</script>
