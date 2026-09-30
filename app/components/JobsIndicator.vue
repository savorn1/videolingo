<template>
  <UTooltip v-if="allowed && counts.total > 0" :text="label">
    <UButton to="/processing-jobs" size="sm" color="neutral" variant="ghost" :aria-label="`${label}. Open the jobs list`" data-testid="jobs-indicator">
      <UIcon name="i-lucide-loader" class="h-4 w-4 animate-spin motion-reduce:animate-none" />
      <span class="text-xs tabular-nums">{{ counts.total }}</span>
    </UButton>
  </UTooltip>
</template>

<script setup lang="ts">
// Shows in the header while background jobs are running or waiting, and opens the
// jobs list. Looks every few seconds while something is going on, seldom otherwise,
// and not at all while the tab is hidden.
import { activeJobs, jobsLabel, nextPollDelay, type JobCounts } from '#shared/utils/jobsIndicator'

const { can } = useAuth()
const { summary } = useProcessingJobs()
const allowed = computed(() => can('processing-jobs', 'READ'))

const raw = ref<JobCounts | null>(null)
const counts = computed(() => activeJobs(raw.value))
const label = computed(() => jobsLabel(raw.value))

let timer: ReturnType<typeof setTimeout> | undefined
async function look() {
  clearTimeout(timer)
  if (!allowed.value) return
  try {
    raw.value = await summary()
  } catch {
    // Not worth an error: the indicator just stays as it was.
  }
  schedule()
}
function schedule() {
  clearTimeout(timer)
  const delay = nextPollDelay(counts.value.total, document.visibilityState === 'hidden')
  if (delay !== null) timer = setTimeout(look, delay)
}
function onVisibility() {
  if (document.visibilityState === 'visible') look()
  else clearTimeout(timer)
}

onMounted(() => {
  look()
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>
