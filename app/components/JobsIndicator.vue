<template>
  <UTooltip v-if="allowed && counts.total > 0" :text="label">
    <UButton
      to="/processing-jobs"
      size="sm"
      color="neutral"
      variant="ghost"
      class="text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/40"
      :aria-label="`${label}. Open the jobs list`"
      data-testid="jobs-indicator"
    >
      <UIcon name="i-lucide-loader" class="h-4 w-4 animate-spin motion-reduce:animate-none" />
      <span class="text-xs tabular-nums">{{ counts.total }}</span>
    </UButton>
  </UTooltip>
</template>

<script setup lang="ts">
// Shows in the header while background jobs are running or waiting, and opens the
// jobs list. The numbers come from useJobActivity, which looks every few seconds
// while something is going on and seldom otherwise.
import { activeJobs, jobsLabel } from '#shared/utils/jobsIndicator'

const { counts: raw, allowed } = useJobActivity()
const counts = computed(() => activeJobs(raw.value))
const label = computed(() => jobsLabel(raw.value))
</script>
