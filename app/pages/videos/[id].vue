<template>
  <div>
    <PageHeader :title="video?.title ?? 'Video'" :crumbs="[{ label: 'Videos', to: '/videos' }, { label: video?.title ?? '…' }]">
      <template v-if="video" #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-captions" :to="`/transcripts?videoId=${video.id}`">Transcripts</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-subtitles" :to="`/subtitles?videoId=${video.id}`">Subtitles</UButton>
        <UButton color="neutral" variant="soft" icon="i-lucide-cpu" :to="`/processing-jobs?videoId=${video.id}`">Processing jobs</UButton>
        <template v-if="video.deleted">
          <UButton color="success" variant="soft" icon="i-lucide-rotate-ccw" :loading="busy" @click="onRestore">Restore</UButton>
        </template>
        <template v-else>
          <UButton color="primary" variant="soft" icon="i-lucide-pencil" @click="showEdit = true">Edit</UButton>
          <UButton v-if="video.enabled" color="warning" variant="soft" icon="i-lucide-eye-off" @click="confirmDisable = true">Disable</UButton>
          <UButton v-else color="success" variant="soft" icon="i-lucide-eye" :loading="busy" @click="setStatus(true)">Enable</UButton>
          <UButton color="error" variant="soft" icon="i-lucide-trash-2" @click="confirmDelete = true">Delete</UButton>
        </template>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/videos">Back to videos</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !video" :fields="6" :lines="false" />

    <template v-else-if="video">
      <UAlert
        v-if="video.deleted"
        class="mb-4"
        color="error"
        variant="subtle"
        icon="i-lucide-trash-2"
        title="This video is in the trash"
        :description="`Deleted ${formatDateTime(video.deletedAt)}. Restore it to edit or re-enable it.`"
      />
      <UAlert
        v-else-if="!video.enabled"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-eye-off"
        title="This video is disabled"
        description="Learners can't watch it until it's enabled again."
      />

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <!-- View Video -->
        <UCard class="xl:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
          <div class="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video
              v-if="!playbackError"
              :key="video.videoUrl"
              :src="video.videoUrl"
              :poster="video.thumbnailUrl ?? undefined"
              controls
              preload="metadata"
              class="w-full h-full"
              @error="playbackError = true"
            />
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white/80">
              <UIcon name="i-lucide-circle-alert" class="w-8 h-8" />
              <p class="font-semibold">This video can't be played here</p>
              <p class="text-sm text-white/60 max-w-sm">The file may be missing, or its format isn't supported by this browser.</p>
              <UButton size="xs" color="neutral" variant="soft" :to="video.videoUrl" target="_blank" icon="i-lucide-external-link" class="mt-2"
                >Open file URL</UButton
              >
            </div>
          </div>
        </UCard>

        <UCard>
          <dl class="space-y-3 text-sm">
            <div class="flex flex-wrap gap-2 pb-1">
              <UBadge v-if="video.deleted" color="error" variant="subtle">In trash</UBadge>
              <UBadge v-else :color="video.enabled ? 'success' : 'warning'" variant="subtle">{{ video.enabled ? 'Enabled' : 'Disabled' }}</UBadge>
              <UBadge v-if="video.language" color="neutral" variant="subtle" icon="i-lucide-languages">{{ languageLabel(video.language) }}</UBadge>
              <CategoryBadge v-for="c in video.categories" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
            </div>
            <div v-for="item in summary" :key="item.label" class="flex justify-between gap-4">
              <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
              <dd class="font-semibold text-gray-900 dark:text-white text-right tabular-nums" :title="item.title">
                <NuxtLink v-if="item.to" :to="item.to" class="text-primary-600 dark:text-primary-400 hover:underline">{{ item.value }}</NuxtLink>
                <template v-else>{{ item.value }}</template>
              </dd>
            </div>
          </dl>
        </UCard>
      </div>

      <UTabs v-model="tab" :items="tabItems" variant="link" class="w-full" :ui="{ list: 'mb-4' }">
        <template #details>
          <UCard>
            <h3 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</h3>
            <p v-if="video.description" class="text-sm text-gray-900 dark:text-white whitespace-pre-line">{{ video.description }}</p>
            <p v-else class="text-sm text-gray-400">No description.</p>
          </UCard>
        </template>

        <!-- View Video Metadata -->
        <template #metadata>
          <UCard>
            <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div v-for="item in metadata" :key="item.label" class="min-w-0">
                <dt class="text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
                <dd class="mt-0.5 font-semibold text-gray-900 dark:text-white break-all" :class="item.mono ? 'font-mono text-xs' : ''" :title="item.title">
                  <a v-if="item.href" :href="item.href" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline">{{
                    item.value
                  }}</a>
                  <template v-else>{{ item.value }}</template>
                </dd>
              </div>
            </dl>
          </UCard>
        </template>

        <!-- View Video Statistics -->
        <template #statistics>
          <div class="flex items-center justify-between gap-3 mb-3">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              <template v-if="stats?.lastViewedAt">Last watched {{ formatRelativeTime(stats.lastViewedAt) }}</template>
              <template v-else-if="stats">Not watched yet</template>
            </p>
            <USelect v-model="statDays" :items="statDayOptions" class="w-36" />
          </div>

          <UAlert v-if="statsError" color="error" variant="subtle" class="mb-3" :title="statsError" icon="i-lucide-triangle-alert" />

          <div class="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 mb-4">
            <StatTile label="Total views" :value="stats ? stats.totalViews.toLocaleString() : '—'" icon="i-lucide-eye" :loading="statsLoading && !stats" />
            <StatTile
              label="Unique viewers"
              :value="stats ? stats.uniqueViewers.toLocaleString() : '—'"
              sublabel="Signed-in learners"
              icon="i-lucide-users"
              color="info"
              :loading="statsLoading && !stats"
            />
            <StatTile
              label="Total watch time"
              :value="stats ? formatWatchTime(stats.totalWatchSeconds) : '—'"
              icon="i-lucide-clock"
              color="neutral"
              :loading="statsLoading && !stats"
            />
            <StatTile
              label="Avg. watch time"
              :value="stats ? formatDuration(stats.averageWatchSeconds) : '—'"
              :sublabel="stats?.averagePercentWatched != null ? `${stats.averagePercentWatched}% of the video` : undefined"
              icon="i-lucide-timer"
              color="neutral"
              :loading="statsLoading && !stats"
            />
            <StatTile
              label="Completion rate"
              :value="stats ? `${stats.completionRate}%` : '—'"
              sublabel="Views that reached the end"
              icon="i-lucide-circle-check"
              color="success"
              :loading="statsLoading && !stats"
            />
            <StatTile
              :label="`Views, last ${statDays} days`"
              :value="stats ? periodViews.toLocaleString() : '—'"
              icon="i-lucide-trending-up"
              color="warning"
              :loading="statsLoading && !stats"
            />
          </div>

          <UCard>
            <template #header>
              <h3 class="font-semibold text-gray-900 dark:text-white">Daily views</h3>
            </template>
            <div v-if="stats && periodViews > 0" class="flex items-end gap-px h-40" role="img" :aria-label="`Daily views over the last ${statDays} days`">
              <div v-for="day in stats.dailyViews" :key="day.date" class="group relative flex-1 h-full flex items-end">
                <div
                  class="w-full rounded-t-sm bg-primary-500/80 group-hover:bg-primary-600 transition-colors min-h-px"
                  :style="{ height: `${(day.views / maxDailyViews) * 100}%` }"
                />
                <div
                  class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white z-10"
                >
                  {{ formatDate(day.date) }} · {{ day.views }} view{{ day.views === 1 ? '' : 's' }}
                </div>
              </div>
            </div>
            <EmptyState
              v-else-if="stats"
              icon="i-lucide-chart-column"
              title="No views in this period"
              description="Views appear here as learners watch this video."
            />
            <USkeleton v-else class="h-40 w-full" />
            <div v-if="stats && periodViews > 0" class="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ formatDate(stats.dailyViews[0]?.date) }}</span>
              <span>{{ formatDate(stats.dailyViews[stats.dailyViews.length - 1]?.date) }}</span>
            </div>
          </UCard>
        </template>
      </UTabs>
    </template>

    <VideoEditModal v-model="showEdit" :video="video" @saved="(saved) => (video = saved)" />

    <ConfirmModal
      v-model="confirmDisable"
      title="Disable video"
      :description="`Disable '${video?.title ?? ''}'? Learners can no longer watch it until it's enabled again.`"
      confirm-label="Disable"
      color="warning"
      :loading="busy"
      @confirm="setStatus(false)"
    />
    <ConfirmModal
      v-model="confirmDelete"
      title="Move to trash"
      :description="`Move '${video?.title ?? ''}' to the trash? It stops being available right away, and you can restore it later.`"
      confirm-label="Move to trash"
      color="error"
      :loading="busy"
      @confirm="onDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { Video, VideoStatistics } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { get, statistics, updateStatus, remove, restore } = useVideos()

const id = computed(() => Number(route.params.id))
const video = ref<Video | null>(null)
const loading = ref(false)
const error = ref('')
const playbackError = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    video.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// ── Tabs (the active one is kept in ?tab= so it can be linked to) ──────────
const tabItems: TabsItem[] = [
  { label: 'Details', value: 'details', slot: 'details', icon: 'i-lucide-file-text' },
  { label: 'Metadata', value: 'metadata', slot: 'metadata', icon: 'i-lucide-info' },
  { label: 'Statistics', value: 'statistics', slot: 'statistics', icon: 'i-lucide-chart-column' }
]
const tab = computed({
  get: () => (typeof route.query.tab === 'string' && tabItems.some((t) => t.value === route.query.tab) ? route.query.tab : 'details'),
  set: (value: string | number) => router.replace({ query: { ...route.query, tab: value === 'details' ? undefined : String(value) } })
})

const summary = computed(() => {
  const v = video.value
  if (!v) return []
  return [
    { label: 'Owner', value: v.ownerUsername ?? (v.ownerId ? 'Deleted user' : '—'), to: v.ownerUsername ? `/users/${v.ownerId}` : undefined },
    { label: 'Duration', value: formatDuration(v.durationSeconds) },
    { label: 'Views', value: v.viewCount.toLocaleString() },
    { label: 'Uploaded', value: formatDate(v.createdAt), title: formatDateTime(v.createdAt) },
    { label: 'Last updated', value: v.updatedAt ? formatRelativeTime(v.updatedAt) : '—', title: formatDateTime(v.updatedAt) }
  ]
})

interface MetadataItem {
  label: string
  value: string
  /** Tooltip, e.g. the full timestamp behind a short one. */
  title?: string
  href?: string
  mono?: boolean
}

const metadata = computed<MetadataItem[]>(() => {
  const v = video.value
  if (!v) return []
  const res = describeResolution(v.width, v.height)
  return [
    { label: 'Video ID', value: String(v.id) },
    { label: 'Duration', value: v.durationSeconds === null ? '—' : `${formatDuration(v.durationSeconds)} (${v.durationSeconds.toLocaleString()} s)` },
    { label: 'Resolution', value: res ? [res.size, res.aspect, res.quality].filter(Boolean).join(' · ') : '—' },
    { label: 'File size', value: v.fileSize === null ? '—' : `${formatFileSize(v.fileSize)} (${v.fileSize.toLocaleString()} bytes)` },
    { label: 'Format', value: v.mimeType ?? '—', mono: true },
    { label: 'Spoken language', value: v.language ? `${languageLabel(v.language)} (${v.language})` : '—' },
    { label: 'Storage', value: v.storageKey ? 'Uploaded file' : 'External URL' },
    { label: 'Storage key', value: v.storageKey ?? '—', mono: true },
    { label: 'Video URL', value: v.videoUrl, href: v.videoUrl, mono: true },
    { label: 'Thumbnail URL', value: v.thumbnailUrl ?? '—', href: v.thumbnailUrl ?? undefined, mono: true },
    { label: 'Uploaded', value: formatDateTime(v.createdAt) },
    { label: 'Last updated', value: formatDateTime(v.updatedAt) },
    ...(v.deleted ? [{ label: 'Deleted', value: formatDateTime(v.deletedAt) }] : [])
  ]
})

// ── Statistics ─────────────────────────────────────────────────────────────
const stats = ref<VideoStatistics | null>(null)
const statsLoading = ref(false)
const statsError = ref('')
const statDays = ref(30)
const statDayOptions = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days', value: 365 }
]

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    stats.value = await statistics(id.value, statDays.value)
  } catch (err) {
    statsError.value = apiErrorMessage(err)
  } finally {
    statsLoading.value = false
  }
}
watch(statDays, loadStats)

const periodViews = computed(() => stats.value?.dailyViews.reduce((sum, d) => sum + d.views, 0) ?? 0)
const maxDailyViews = computed(() => Math.max(1, ...(stats.value?.dailyViews.map((d) => d.views) ?? [])))

onMounted(() => {
  load()
  loadStats()
})

// ── Actions ────────────────────────────────────────────────────────────────
const showEdit = ref(false)
const busy = ref(false)
const confirmDisable = ref(false)
const confirmDelete = ref(false)

async function setStatus(enabled: boolean) {
  if (!video.value) return
  busy.value = true
  try {
    video.value = await updateStatus(video.value.id, enabled)
    confirmDisable.value = false
    toast.add({ title: enabled ? 'Video enabled' : 'Video disabled', color: 'success' })
  } catch (err) {
    toast.add({ title: `Could not ${enabled ? 'enable' : 'disable'} video`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onDelete() {
  if (!video.value) return
  busy.value = true
  try {
    await remove(video.value.id)
    confirmDelete.value = false
    toast.add({ title: 'Moved to trash', color: 'success' })
    // Stay on the page — it now shows the trash banner and a Restore button,
    // which doubles as an undo.
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onRestore() {
  if (!video.value) return
  busy.value = true
  try {
    video.value = await restore(video.value.id)
    toast.add({ title: 'Video restored', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not restore video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>
