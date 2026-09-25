<template>
  <div class="space-y-4">
    <PageHeader :title="greeting" :description="hasAnyAccess ? 'Here’s what’s happening across VideoLingo in the last 30 days.' : undefined">
      <template v-if="canWriteVideos || canReadAnalytics" #actions>
        <UButton v-if="canReadAnalytics" color="neutral" variant="soft" icon="i-lucide-chart-no-axes-combined" to="/analytics">Analytics</UButton>
        <UButton v-if="canWriteVideos" icon="i-lucide-plus" to="/videos/new">Add video</UButton>
      </template>
    </PageHeader>

    <!-- No admin access: nothing to manage, so just point to what they can do. -->
    <EmptyState
      v-if="!hasAnyAccess"
      icon="i-lucide-user"
      title="You're signed in"
      description="Your account doesn't have access to any admin areas yet. Ask an administrator if you think it should."
    >
      <template #action>
        <UButton color="neutral" variant="soft" icon="i-lucide-user" to="/profile">Go to your profile</UButton>
      </template>
    </EmptyState>

    <template v-else>
      <ContinueWatching />

      <!-- ── Headline numbers ─────────────────────────────────────────── -->
      <template v-if="canReadAnalytics">
        <UAlert v-if="analyticsError" color="error" variant="subtle" :title="analyticsError" icon="i-lucide-triangle-alert" />
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiTile
            label="Views"
            icon="i-lucide-play"
            :value="formatCount(watchStats?.views.current)"
            :delta="watchStats && describeDelta(watchStats.views.current, watchStats.views.previous)"
            compared-to="vs previous 30 days"
            :loading="!watchStats && !analyticsError"
          />
          <KpiTile
            label="Watch time"
            icon="i-lucide-hourglass"
            :value="formatWatchTime(watchStats?.watchSeconds.current)"
            :delta="watchStats && describeDelta(watchStats.watchSeconds.current, watchStats.watchSeconds.previous)"
            compared-to="vs previous 30 days"
            :loading="!watchStats && !analyticsError"
          />
          <KpiTile
            label="Active learners"
            icon="i-lucide-users"
            :value="formatCount(users?.activeViewers.current)"
            :delta="users && describeDelta(users.activeViewers.current, users.activeViewers.previous)"
            compared-to="vs previous 30 days"
            :sublabel="users ? `${formatCount(users.newUsers.current)} new accounts` : ''"
            :loading="!users && !analyticsError"
          />
          <KpiTile
            label="New videos"
            icon="i-lucide-video"
            :value="formatCount(videos?.uploads.current)"
            :delta="videos && describeDelta(videos.uploads.current, videos.uploads.previous)"
            compared-to="vs previous 30 days"
            :sublabel="videos ? `${formatCount(videos.totalVideos)} in the library` : ''"
            :loading="!videos && !analyticsError"
          />
        </div>
      </template>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div class="xl:col-span-2 space-y-4 min-w-0">
          <!-- ── Views trend ──────────────────────────────────────────── -->
          <UCard v-if="canReadAnalytics && !analyticsError">
            <USkeleton v-if="!watchStats" class="h-52" />
            <TrendChart v-else :title="`Views per ${viewsTrend.per}`" :items="viewsTrend.items" unit="views" value-label="Views" />
          </UCard>

          <!-- ── Recent videos ────────────────────────────────────────── -->
          <UCard v-if="canReadVideos" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Recently added videos</h2>
                <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" to="/videos">All videos</UButton>
              </div>
            </template>
            <div v-if="recentLoading && !recent.length" class="p-4 space-y-3">
              <USkeleton v-for="n in 4" :key="n" class="h-12 w-full" />
            </div>
            <EmptyState
              v-else-if="!recent.length"
              icon="i-lucide-clapperboard"
              title="No videos yet"
              description="Add your first learning video to get started."
            >
              <template v-if="canWriteVideos" #action>
                <UButton icon="i-lucide-plus" to="/videos/new">Add video</UButton>
              </template>
            </EmptyState>
            <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="v in recent" :key="v.id">
                <NuxtLink :to="`/videos/${v.id}`" class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <div class="relative w-20 aspect-video shrink-0 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" class="w-full h-full object-cover" loading="lazy" />
                    <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-5 h-5 text-gray-400" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ v.title }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {{ [v.language ? languageLabel(v.language) : null, formatDuration(v.durationSeconds), v.ownerUsername].filter(Boolean).join(' · ') }}
                    </p>
                  </div>
                  <UBadge v-if="!v.enabled" color="warning" variant="subtle" size="sm">Disabled</UBadge>
                  <span class="text-xs text-gray-400 shrink-0 hidden sm:inline" :title="formatDateTime(v.createdAt)">{{
                    formatRelativeTime(v.createdAt)
                  }}</span>
                </NuxtLink>
              </li>
            </ul>
          </UCard>
        </div>

        <div class="space-y-4 min-w-0">
          <!-- ── Needs attention ──────────────────────────────────────── -->
          <UCard v-if="attention.length || attentionLoading" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Needs attention</h2>
              </div>
            </template>
            <div v-if="attentionLoading && !attention.length" class="p-4 space-y-3">
              <USkeleton v-for="n in 3" :key="n" class="h-8 w-full" />
            </div>
            <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="item in attention" :key="item.label">
                <NuxtLink :to="item.to" class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <span class="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" :class="item.tone">
                    <UIcon :name="item.icon" class="w-4 h-4" />
                  </span>
                  <span class="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300">{{ item.label }}</span>
                  <span class="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ item.count.toLocaleString() }}</span>
                  <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-gray-400" />
                </NuxtLink>
              </li>
            </ul>
          </UCard>
          <UCard v-else-if="attentionChecked">
            <div class="flex items-center gap-3 text-sm">
              <span class="flex items-center justify-center w-8 h-8 rounded-lg bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400">
                <UIcon name="i-lucide-check" class="w-4 h-4" />
              </span>
              <span class="text-gray-700 dark:text-gray-300">All caught up — nothing needs attention.</span>
            </div>
          </UCard>

          <!-- ── Running jobs ─────────────────────────────────────────── -->
          <UCard v-if="canReadJobs && runningJobs.length" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Processing now</h2>
                <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" to="/processing-jobs?status=RUNNING">All jobs</UButton>
              </div>
            </template>
            <ul class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="job in runningJobs" :key="job.id">
                <NuxtLink :to="`/processing-jobs/${job.id}`" class="block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <div class="flex items-center justify-between gap-2 text-sm">
                    <span class="truncate text-gray-900 dark:text-white"
                      >{{ jobTypeMeta(job.type).label }} · {{ job.videoTitle ?? `Video #${job.videoId}` }}</span
                    >
                    <span class="text-xs tabular-nums text-gray-500">{{ job.progress }}%</span>
                  </div>
                  <UProgress :model-value="job.progress" size="xs" class="mt-1.5" />
                </NuxtLink>
              </li>
            </ul>
          </UCard>

          <!-- ── Most watched ─────────────────────────────────────────── -->
          <UCard v-if="canReadAnalytics && watchStats?.topVideos.length" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold text-gray-900 dark:text-white">Most watched</h2>
                <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" to="/analytics?tab=watch">Details</UButton>
              </div>
            </template>
            <ol class="divide-y divide-gray-100 dark:divide-gray-800">
              <li v-for="(v, i) in watchStats.topVideos.slice(0, 5)" :key="v.videoId">
                <NuxtLink :to="`/videos/${v.videoId}`" class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <span class="w-5 text-xs font-semibold text-gray-400 tabular-nums">{{ i + 1 }}</span>
                  <span class="flex-1 min-w-0 text-sm text-gray-900 dark:text-white truncate">{{ v.title }}</span>
                  <span class="text-xs text-gray-500 tabular-nums">{{ formatCount(v.views) }} views</span>
                </NuxtLink>
              </li>
            </ol>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// Home page: last-30-day headline numbers, what needs fixing, what's
// running, and the newest videos. Each section only loads — and only shows —
// when the signed-in account may read that module.
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { UserAnalytics, VideoAnalytics, WatchAnalytics } from '~/composables/useAnalytics'
import type { Video } from '~/composables/useVideos'

const { username, hasAnyAccess, can } = useAuth()
const canReadAnalytics = computed(() => can('analytics', 'READ'))
const canReadVideos = computed(() => can('videos', 'READ'))
const canWriteVideos = computed(() => can('videos', 'WRITE'))
const canReadJobs = computed(() => can('processing-jobs', 'READ'))
const canReadSubtitles = computed(() => can('subtitles', 'READ'))

const greeting = computed(() => {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return username.value ? `${part}, ${username.value}` : part
})

// ── Analytics ──────────────────────────────────────────────────────────────
const { get: getAnalytics } = useAnalytics()
const range = rangeDates('30d')
const watchStats = ref<WatchAnalytics | null>(null)
const users = ref<UserAnalytics | null>(null)
const videos = ref<VideoAnalytics | null>(null)
const analyticsError = ref('')
const viewsTrend = computed(() => trendItems(watchStats.value?.viewsDaily ?? []))

async function loadAnalytics() {
  if (!canReadAnalytics.value) return
  try {
    ;[watchStats.value, users.value, videos.value] = await Promise.all([
      getAnalytics('watch', range.from, range.to),
      getAnalytics('users', range.from, range.to),
      getAnalytics('videos', range.from, range.to)
    ])
  } catch (err) {
    analyticsError.value = apiErrorMessage(err)
  }
}

// ── Recent videos ──────────────────────────────────────────────────────────
const { list: listVideos } = useVideos()
const recent = ref<Video[]>([])
const recentLoading = ref(false)

async function loadRecent() {
  if (!canReadVideos.value) return
  recentLoading.value = true
  try {
    recent.value = (await listVideos({ sortBy: 'createdAt', sortOrder: 'desc', size: 6 })).data
  } catch {
    // The card just stays empty; the Videos page shows the real error.
  } finally {
    recentLoading.value = false
  }
}

// ── Jobs & attention ───────────────────────────────────────────────────────
const { list: listJobs } = useProcessingJobs()
const { list: listSubtitles } = useSubtitles()
const runningJobs = ref<ProcessingJob[]>([])
const failedJobs = ref(0)
const subtitlesWithIssues = ref(0)
const attentionLoading = ref(false)
const attentionChecked = ref(false)

async function loadAttention() {
  attentionLoading.value = true
  // Each count is independent — one failing (or not permitted) shouldn't hide the rest.
  await Promise.allSettled([
    canReadJobs.value && listJobs({ status: 'FAILED', size: 1 }).then((r) => (failedJobs.value = r.metadata.totalCount)),
    canReadJobs.value && listJobs({ status: 'RUNNING', size: 5, sortBy: 'id', sortOrder: 'desc' }).then((r) => (runningJobs.value = r.data)),
    canReadSubtitles.value && listSubtitles({ hasIssues: true, size: 1 }).then((r) => (subtitlesWithIssues.value = r.metadata.totalCount))
  ])
  attentionLoading.value = false
  attentionChecked.value = true
}

const attention = computed(() => {
  const items: { label: string; count: number; icon: string; to: string; tone: string }[] = []
  const bad = 'bg-error-50 text-error-600 dark:bg-error-950/40 dark:text-error-400'
  const warn = 'bg-warning-50 text-warning-600 dark:bg-warning-950/40 dark:text-warning-400'
  const info = 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
  if (failedJobs.value)
    items.push({ label: 'Failed processing jobs', count: failedJobs.value, icon: 'i-lucide-circle-x', to: '/processing-jobs?status=FAILED', tone: bad })
  if (subtitlesWithIssues.value)
    items.push({
      label: 'Subtitle tracks with warnings',
      count: subtitlesWithIssues.value,
      icon: 'i-lucide-triangle-alert',
      to: '/subtitles?hasIssues=true',
      tone: warn
    })
  const v = videos.value
  if (v?.withoutSubtitles)
    items.push({ label: 'Videos without subtitles', count: v.withoutSubtitles, icon: 'i-lucide-subtitles', to: '/analytics?tab=videos', tone: info })
  if (v?.withoutTranscript)
    items.push({ label: 'Videos without a transcript', count: v.withoutTranscript, icon: 'i-lucide-captions', to: '/analytics?tab=videos', tone: info })
  if (v?.withoutCategory)
    items.push({ label: 'Videos without a category', count: v.withoutCategory, icon: 'i-lucide-folder-tree', to: '/analytics?tab=videos', tone: info })
  return items
})

// Permissions can arrive just after the page mounts (right after sign-in).
// Started once mounted: loading during setup would flip the loading flags
// before hydration, so the browser's first render (skeletons) wouldn't match
// the server's HTML (empty states) — a hydration mismatch.
let loaded = false
onMounted(() => {
  watch(
    hasAnyAccess,
    (access) => {
      if (!access || loaded) return
      loaded = true
      loadAnalytics()
      loadRecent()
      loadAttention()
    },
    { immediate: true }
  )
})
</script>
