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
// while something is going on and seldom otherwise. When jobs end it says so — on
// any page — and, with the tab hidden and the browser's permission, as a desktop
// notification.
import { activeJobs, endedJobsMessage, jobsLabel } from '#shared/utils/jobsIndicator'
import { jobTypeMeta } from '#shared/utils/processingJobs'

const toast = useToast()
const { get } = useProcessingJobs()
const { counts: raw, allowed } = useJobActivity({ onJobsEnded: tellEnded })
const counts = computed(() => activeJobs(raw.value))
const label = computed(() => jobsLabel(raw.value))

/** Asked once per browser whether desktop notifications are wanted. */
const ASKED_KEY = 'videolingo.jobAlertsAsked'

async function tellEnded(jobIds: number[]) {
  // A few by name; beyond that the count says enough.
  const found = await Promise.all(jobIds.slice(0, 5).map((id) => get(id).catch(() => null)))
  const jobs = found
    .filter((j): j is NonNullable<typeof j> => !!j && !isActiveJobStatus(j.status))
    .map((j) => ({ id: j.id, status: j.status, typeLabel: jobTypeMeta(j.type).label, videoTitle: j.videoTitle, errorMessage: j.errorMessage }))
  const message = endedJobsMessage(jobs)
  if (!message) return

  const actions: { label: string; color?: 'neutral'; variant?: 'outline' | 'link'; onClick: () => void }[] = [
    { label: 'Open', color: 'neutral', variant: 'outline', onClick: () => navigateTo(message.to) }
  ]
  if (canOfferAlerts()) actions.push({ label: 'Alert me in other tabs', variant: 'link', onClick: askForAlerts })
  toast.add({
    title: message.title,
    description: message.description,
    color: message.color,
    icon: message.color === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-circle-check',
    actions
  })

  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(message.title, { body: message.description, tag: 'videolingo-jobs' })
    n.onclick = () => {
      window.focus()
      navigateTo(message.to)
      n.close()
    }
  }
}

function canOfferAlerts() {
  try {
    return 'Notification' in window && Notification.permission === 'default' && !localStorage.getItem(ASKED_KEY)
  } catch {
    return false
  }
}
async function askForAlerts() {
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    // Asked again next time; harmless.
  }
  const answer = await Notification.requestPermission()
  if (answer === 'granted')
    toast.add({ title: 'Alerts on', description: 'When a job ends while this tab is in the background, your computer says so.', color: 'success' })
}
</script>
