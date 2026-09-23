<template>
  <div class="min-w-0" :class="size === 'lg' ? 'space-y-2' : 'space-y-1'">
    <div class="flex items-center justify-between gap-3" :class="size === 'lg' ? 'text-sm' : 'text-xs'">
      <span class="truncate text-gray-600 dark:text-gray-300" :title="caption">{{ caption }}</span>
      <span v-if="status !== 'QUEUED'" class="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">{{ progress }}%</span>
    </div>
    <UProgress
      :model-value="status === 'QUEUED' ? null : progress"
      :color="color"
      :size="size === 'lg' ? 'md' : 'xs'"
      :animation="status === 'QUEUED' ? 'carousel' : undefined"
    />
  </div>
</template>

<script setup lang="ts">
import type { JobStatus } from '#shared/utils/processingJobs'

const props = withDefaults(
  defineProps<{
    status: JobStatus
    progress: number
    currentStep?: string | null
    size?: 'sm' | 'lg'
  }>(),
  { currentStep: null, size: 'sm' }
)

// Queued jobs show an indeterminate bar — "waiting for a worker" isn't 0%
// progress, it's no progress information yet.
const color = computed(() => {
  switch (props.status) {
    case 'SUCCEEDED':
      return 'success'
    case 'FAILED':
      return 'error'
    case 'CANCELLED':
      return 'neutral'
    default:
      return 'primary'
  }
})

const caption = computed(() => {
  if (props.currentStep) return props.currentStep
  switch (props.status) {
    case 'QUEUED':
      return 'Waiting for a worker…'
    case 'RUNNING':
      return 'Running…'
    case 'SUCCEEDED':
      return 'Done'
    case 'FAILED':
      return 'Failed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return ''
  }
})
</script>
