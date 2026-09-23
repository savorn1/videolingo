<template>
  <div>
    <PageHeader title="AI Studio" description="Summaries, chapters, key points, questions, quizzes and chat — generated from each video's transcript.">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-chart-column" to="/ai/usage">Usage &amp; cost</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="statusError" color="error" variant="subtle" class="mb-4" :title="statusError" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard>
        <p class="text-sm text-gray-500 dark:text-gray-400">Status</p>
        <USkeleton v-if="!status" class="h-8 w-32 mt-1.5" />
        <template v-else>
          <p
            class="mt-1 flex items-center gap-2 text-lg font-semibold"
            :class="status.configured ? 'text-gray-900 dark:text-white' : 'text-warning-700 dark:text-warning-400'"
          >
            <UIcon
              :name="status.configured ? 'i-lucide-circle-check' : 'i-lucide-plug-zap'"
              :class="status.configured ? 'text-success-600' : ''"
              class="w-5 h-5"
            />
            {{ !status.configured ? 'Not configured' : status.enabled ? 'Connected' : 'Turned off in Settings' }}
          </p>
          <p v-if="!status.configured" class="text-xs text-gray-500 mt-1">Set ANTHROPIC_API_KEY on the backend and restart it.</p>
          <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt class="text-gray-500">Model</dt>
            <dd class="font-mono text-gray-800 dark:text-gray-200">{{ status.model }}</dd>
            <template v-if="status.fallbackModel">
              <dt class="text-gray-500">If declined</dt>
              <dd class="font-mono text-gray-800 dark:text-gray-200">{{ status.fallbackModel }}</dd>
            </template>
            <dt class="text-gray-500">Effort</dt>
            <dd class="text-gray-800 dark:text-gray-200">{{ status.generationEffort }} (generate) · {{ status.chatEffort }} (chat)</dd>
          </dl>
        </template>
      </UCard>

      <UCard class="lg:col-span-2">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Spent this month</p>
            <USkeleton v-if="!status" class="h-8 w-24 mt-1.5" />
            <p v-else class="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{{ formatUsd(status.monthSpendUsd) }}</p>
          </div>
          <UButton size="sm" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" to="/ai/usage">Details</UButton>
        </div>
        <template v-if="status?.monthlyBudgetUsd">
          <UProgress :model-value="budgetPercent" :color="budgetColor" size="sm" class="mt-3" :aria-label="`${budgetPercent}% of the monthly budget used`" />
          <p class="text-xs text-gray-500 mt-1.5">
            {{ budgetPercent }}% of the {{ formatUsd(status.monthlyBudgetUsd) }} monthly budget
            <template v-if="status.budgetEnforced"> · requests stop when it's used up</template>
            <template v-else> · soft limit (not enforced)</template>
          </p>
        </template>
        <p v-else-if="status" class="text-xs text-gray-500 mt-3">No monthly budget set (AI_MONTHLY_BUDGET_USD).</p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-semibold text-gray-900 dark:text-white">Choose a video</h2>
          <UInput v-model="search" placeholder="Search videos" icon="i-lucide-search" class="w-64" aria-label="Search videos" />
        </div>
      </template>
      <div v-if="loadingVideos && !videoRows.length" class="space-y-2">
        <USkeleton v-for="i in 4" :key="i" class="h-14" />
      </div>
      <EmptyState
        v-else-if="!videoRows.length"
        icon="i-lucide-video-off"
        title="No videos found"
        :description="search ? 'Try a different search.' : 'Upload a video first.'"
      />
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
        <li v-for="v in videoRows" :key="v.id">
          <NuxtLink :to="`/ai/videos/${v.id}`" class="flex items-center gap-3 py-2.5 px-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900 group">
            <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" class="w-20 h-12 object-cover rounded shrink-0 bg-gray-100 dark:bg-gray-800" />
            <span v-else class="w-20 h-12 rounded shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <UIcon name="i-lucide-video" class="w-5 h-5 text-gray-400" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900 dark:text-white truncate group-hover:underline">{{ v.title }}</p>
              <p class="text-xs text-gray-500">{{ languageLabel(v.language) }} · {{ formatDuration(v.durationSeconds) }}</p>
            </div>
            <UIcon name="i-lucide-sparkles" class="w-4 h-4 text-primary-500 opacity-0 group-hover:opacity-100" />
          </NuxtLink>
        </li>
      </ul>
      <DataPagination v-if="videoTotal > 10" v-model:page="page" v-model:page-size="pageSize" :total="videoTotal" class="mt-3" />
    </UCard>

    <UCard class="mt-4">
      <template #header>
        <h2 class="font-semibold text-gray-900 dark:text-white">Recent AI activity</h2>
      </template>
      <p v-if="!recent.length" class="text-sm text-gray-500">No AI requests yet.</p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
        <li v-for="u in recent" :key="u.id" class="flex items-center gap-3 py-2">
          <UIcon :name="aiFeatureIcon(u.feature)" class="w-4 h-4 text-gray-400 shrink-0" />
          <span class="w-24 shrink-0 text-gray-700 dark:text-gray-300">{{ aiFeatureLabel(u.feature) }}</span>
          <UBadge :color="usageStatusColor(u.status)" variant="subtle" size="sm" class="shrink-0">{{ formatEnum(u.status) }}</UBadge>
          <NuxtLink
            v-if="u.videoId"
            :to="`/ai/videos/${u.videoId}${u.feature === 'CHAT' ? '?tab=chat' : ''}`"
            class="text-primary-600 dark:text-primary-400 hover:underline shrink-0"
          >
            Video #{{ u.videoId }}
          </NuxtLink>
          <span class="text-gray-500 truncate flex-1">{{ u.username ?? '—' }}</span>
          <span class="font-medium tabular-nums">{{ formatUsd(u.costUsd) }}</span>
          <span class="text-xs text-gray-400 w-20 text-right" :title="formatDateTime(u.createdAt)">{{ formatRelativeTime(u.createdAt) }}</span>
        </li>
      </ul>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { AiStatus, AiUsage } from '~/composables/useAi'
import type { Video } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const ai = useAi()
const videos = useVideos()

const status = ref<AiStatus | null>(null)
const statusError = ref('')
const recent = ref<AiUsage[]>([])

const search = ref('')
const debouncedSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value
    page.value = 1
  }, 300)
})
const page = ref(1)
const pageSize = ref(10)
const videoRows = ref<Video[]>([])
const videoTotal = ref(0)
const loadingVideos = ref(true)

const budgetPercent = computed(() => {
  const s = status.value
  if (!s?.monthlyBudgetUsd) return 0
  return Math.min(100, Math.round((s.monthSpendUsd / s.monthlyBudgetUsd) * 100))
})
const budgetColor = computed(() => (budgetPercent.value >= 100 ? 'error' : budgetPercent.value >= 80 ? 'warning' : 'primary'))

function usageStatusColor(s: string): 'success' | 'warning' | 'error' | 'neutral' {
  return s === 'SUCCESS' ? 'success' : s === 'REFUSED' || s === 'TRUNCATED' ? 'warning' : 'error'
}

async function loadVideos() {
  loadingVideos.value = true
  try {
    const res = await videos.list({
      search: debouncedSearch.value || undefined,
      page: page.value,
      size: pageSize.value,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
    videoRows.value = res.data
    videoTotal.value = res.metadata.totalCount
  } catch {
    videoRows.value = []
  } finally {
    loadingVideos.value = false
  }
}
watch([debouncedSearch, page, pageSize], loadVideos)

onMounted(async () => {
  loadVideos()
  try {
    status.value = await ai.status()
    recent.value = (await ai.usage({ size: 8 })).data
  } catch (err) {
    statusError.value = apiErrorMessage(err)
  }
})
</script>
