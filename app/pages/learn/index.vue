<template>
  <div>
    <PageHeader title="Learn" description="Watch with subtitles in two languages, look up any word, and practise with flashcards and quizzes." />

    <UAlert
      v-if="stats && stats.due"
      color="primary"
      variant="subtle"
      icon="i-lucide-layers"
      class="mb-6"
      :title="`${stats.due} card${stats.due === 1 ? '' : 's'} to review`"
      description="A few minutes of review now makes the words stick."
    >
      <template #actions>
        <UButton size="sm" icon="i-lucide-play" to="/learn/cards">Review now</UButton>
      </template>
    </UAlert>

    <ContinueWatching />

    <!-- Collections -->
    <section v-if="collections.length" class="mb-6">
      <h2 class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-library" class="w-4 h-4 text-gray-400" />
        Courses & collections
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        <NuxtLink
          v-for="c in collections"
          :key="c.id"
          :to="`/learn/collections/${c.id}`"
          class="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md hover:border-primary-300 transition"
        >
          <CollectionCover :src="c.coverUrl">
            <span class="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white">
              {{ c.videoCount }} video{{ c.videoCount === 1 ? '' : 's' }}
            </span>
          </CollectionCover>
          <div class="p-3">
            <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-2">{{ c.title }}</h3>
            <p v-if="c.description" class="mt-1 text-xs text-gray-500 line-clamp-2">{{ c.description }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- All videos -->
    <section>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-lucide-clapperboard" class="w-4 h-4 text-gray-400" />
          All videos
        </h2>
        <div class="flex flex-wrap gap-2">
          <UInput v-model="search" placeholder="Search videos" icon="i-lucide-search" size="sm" class="w-56" />
          <USelect v-model="language" :items="languageFilterOptions" size="sm" class="w-40" placeholder="Language" />
        </div>
      </div>

      <div v-if="loading && !videos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        <USkeleton v-for="n in 8" :key="n" class="aspect-video w-full rounded-xl" />
      </div>
      <EmptyState
        v-else-if="!videos.length"
        icon="i-lucide-search-x"
        :title="search || language ? 'No videos match' : 'No videos yet'"
        :description="search || language ? 'Try a different search.' : 'Videos will appear here once they are added.'"
      />
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4" :class="loading ? 'opacity-60' : ''">
        <VideoCard
          v-for="v in videos"
          :key="v.id"
          :to="`/learn/watch/${v.id}`"
          :title="v.title"
          :thumbnail-url="v.thumbnailUrl"
          :duration-seconds="v.durationSeconds"
          :progress="progress.get(v.id)"
        >
          <p class="text-xs text-gray-500">
            {{ languageLabel(v.language) }}<template v-if="v.sourceAuthor"> · {{ v.sourceAuthor }}</template>
          </p>
        </VideoCard>
      </div>
      <div v-if="total > pageSize" class="pt-6">
        <DataPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-size-options="[12, 24, 48].map((n) => ({ label: String(n), value: n }))"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// The learner's home: what they were watching, what's due for review, public
// collections and every video. Open to every signed-in account.
import type { Collection } from '~/composables/useCollections'
import type { Video } from '~/composables/useVideos'
import type { WatchProgress } from '~/composables/useWatchProgress'

const { videos: listVideos, collections: listCollections } = useLearn()
const { forVideos } = useWatchProgress()
const { stats: cardStats } = useStudy()

const stats = ref<{ total: number; due: number } | null>(null)
const collections = ref<Collection[]>([])
const videos = ref<Video[]>([])
const progress = ref(new Map<number, WatchProgress>())
const total = ref(0)
const loading = ref(false)
const search = ref('')
const language = ref<string | undefined>()
const page = ref(1)
const pageSize = ref(12)
const languageFilterOptions = computed(() => [{ label: 'All languages', value: undefined }, ...languageOptions(language.value)])

let seq = 0
async function loadVideos() {
  const mine = ++seq
  loading.value = true
  try {
    const res = await listVideos({
      search: search.value.trim() || undefined,
      language: language.value,
      page: page.value,
      size: pageSize.value,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
    if (mine !== seq) return
    videos.value = res.data
    total.value = res.metadata.totalCount
    progress.value = await forVideos(res.data.map((v) => v.id)).catch(() => new Map())
  } catch {
    if (mine === seq) videos.value = []
  } finally {
    if (mine === seq) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    loadVideos()
  }, 300)
})
watch([language, pageSize], () => {
  page.value = 1
  loadVideos()
})
watch(page, loadVideos)

onMounted(() => {
  loadVideos()
  listCollections({ size: 8 })
    .then((r) => (collections.value = r.data))
    .catch(() => (collections.value = []))
  cardStats()
    .then((s) => (stats.value = s))
    .catch(() => (stats.value = null))
})
</script>
