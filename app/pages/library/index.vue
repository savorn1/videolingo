<template>
  <div>
    <PageHeader title="Library" description="Every video at a glance. Open one to watch it, or manage videos in the table view.">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-table" to="/videos">Table view</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search title or description" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.categoryId" :items="categoryFilterOptions" placeholder="Category" class="w-44" />
        <USelect v-model="filter.language" :items="languageFilterOptions" placeholder="Language" class="w-44" />
        <USelect v-model="filter.sort" :items="SORTS" class="w-44" aria-label="Sort" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <!-- First load: placeholder cards in the same grid. -->
    <div v-if="loading && !videos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
      <div v-for="n in pageSize" :key="n" class="space-y-2">
        <USkeleton class="aspect-video w-full rounded-lg" />
        <USkeleton class="h-4 w-3/4" />
        <USkeleton class="h-3 w-1/2" />
      </div>
    </div>

    <EmptyState
      v-else-if="!videos.length"
      :icon="hasActiveFilter ? 'i-lucide-search-x' : 'i-lucide-clapperboard'"
      :title="hasActiveFilter ? 'No videos match your filters' : 'No videos yet'"
      :description="hasActiveFilter ? 'Try a different search or clear your filters.' : 'Add a video to see it here.'"
    >
      <template #action>
        <UButton v-if="hasActiveFilter" color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
        <UButton v-else-if="can('videos', 'WRITE')" icon="i-lucide-plus" to="/videos/new">Add video</UButton>
      </template>
    </EmptyState>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4" :class="loading ? 'opacity-60 transition-opacity' : ''">
      <VideoCard
        v-for="v in videos"
        :key="v.id"
        :to="`/videos/${v.id}`"
        :title="v.title"
        :thumbnail-url="v.thumbnailUrl"
        :duration-seconds="v.durationSeconds"
        :progress="progress.get(v.id)"
      >
        <template v-if="!v.enabled" #badge>
          <UBadge color="neutral" variant="solid" size="sm" class="absolute top-2 left-2">Disabled</UBadge>
        </template>
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <UBadge v-if="v.language" size="sm" color="neutral" variant="subtle" icon="i-lucide-mic">{{ languageLabel(v.language) }}</UBadge>
          <UTooltip v-if="subtitleLanguages(v.id).length" :text="`Subtitles: ${subtitleLanguages(v.id).map(languageLabel).join(', ')}`">
            <UBadge size="sm" color="primary" variant="subtle" icon="i-lucide-subtitles">
              {{
                subtitleLanguages(v.id)
                  .slice(0, 3)
                  .map((c) => c.toUpperCase())
                  .join(' · ')
              }}{{ subtitleLanguages(v.id).length > 3 ? ` +${subtitleLanguages(v.id).length - 3}` : '' }}
            </UBadge>
          </UTooltip>
          <CategoryBadge v-for="c in v.categories.slice(0, 2)" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
        </div>
        <p class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span class="flex items-center gap-1"><UIcon name="i-lucide-eye" class="w-3.5 h-3.5" />{{ v.viewCount.toLocaleString() }}</span>
          <span v-if="v.createdAt" :title="formatDateTime(v.createdAt)">{{ formatRelativeTime(v.createdAt) }}</span>
          <span v-if="v.ownerUsername" class="truncate">by {{ v.ownerUsername }}</span>
        </p>
      </VideoCard>
    </div>

    <div v-if="total > 0" class="pt-6">
      <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" :page-size-options="PAGE_SIZES" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Video } from '~/composables/useVideos'
import type { WatchProgress } from '~/composables/useWatchProgress'

definePageMeta({ middleware: 'admin' })

const { list } = useVideos()
const { list: listSubtitles } = useSubtitles()
const { can } = useAuth()

const videos = ref<Video[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

// Multiples of 12 fill the 2-, 3- and 4-column grids evenly.
const PAGE_SIZES = [12, 24, 48].map((n) => ({ label: String(n), value: n }))
const SORTS = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Title A–Z', value: 'title' },
  { label: 'Longest first', value: 'longest' }
]
const SORT_PARAMS: Record<string, { sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  newest: { sortBy: 'createdAt', sortOrder: 'desc' },
  oldest: { sortBy: 'createdAt', sortOrder: 'asc' },
  title: { sortBy: 'title', sortOrder: 'asc' },
  longest: { sortBy: 'durationSeconds', sortOrder: 'desc' }
}

const filter = reactive<{ categoryId: number | undefined; language: string | undefined; sort: string }>({
  categoryId: undefined,
  language: undefined,
  sort: 'newest'
})
const search = ref('')
const page = ref(1)
const pageSize = ref(24)

useListQuerySync({ filter, search, page })

const categoryFilterOptions = computed(() => [
  { label: 'All categories', value: undefined },
  ...categoryCatalog().map((c) => ({ label: c.enabled ? c.name : `${c.name} (disabled)`, value: c.id }))
])
const languageFilterOptions = computed(() => [{ label: 'All languages', value: undefined }, ...languageOptions(filter.language)])

// Subtitle languages per video on this page — one request for the whole page.
const subtitlesByVideo = ref(new Map<number, string[]>())
const subtitleLanguages = (videoId: number) => subtitlesByVideo.value.get(videoId) ?? []
async function loadSubtitleLanguages(ids: number[]) {
  subtitlesByVideo.value = new Map()
  if (!ids.length || !can('subtitles', 'READ')) return
  try {
    const tracks = (await listSubtitles({ videoIds: ids, size: 500 })).data
    const map = new Map<number, string[]>()
    for (const t of tracks) {
      const langs = map.get(t.videoId) ?? []
      if (!langs.includes(t.language)) langs.push(t.language)
      map.set(t.videoId, langs)
    }
    subtitlesByVideo.value = map
  } catch {
    // Just no subtitle badges.
  }
}

// This viewer's progress on the page's videos (bars and ✓ on the cards).
const { forVideos } = useWatchProgress()
const progress = ref(new Map<number, WatchProgress>())
async function loadProgress(ids: number[]) {
  try {
    progress.value = await forVideos(ids)
  } catch {
    progress.value = new Map()
  }
}

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      categoryId: filter.categoryId,
      language: filter.language,
      ...(SORT_PARAMS[filter.sort] ?? SORT_PARAMS.newest),
      page: page.value,
      size: pageSize.value
    })
    if (seq !== requestSeq) return
    videos.value = res.data
    total.value = res.metadata.totalCount
    loadSubtitleLanguages(res.data.map((v) => v.id))
    loadProgress(res.data.map((v) => v.id))
  } catch (err) {
    if (seq === requestSeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const debouncedSearch = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})
watch([() => ({ ...filter }), debouncedSearch, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, page, pageSize], load)
// Back to the top when paging, so the new page starts at its first card.
watch(page, () => import.meta.client && window.scrollTo({ top: 0, behavior: 'smooth' }))

const hasActiveFilter = computed(() => search.value !== '' || filter.categoryId !== undefined || filter.language !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.categoryId = undefined
  filter.language = undefined
}

onMounted(load)
</script>
