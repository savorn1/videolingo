<template>
  <div>
    <PageHeader
      :title="collection?.title ?? 'Collection'"
      :description="collection?.description ?? undefined"
      :crumbs="[{ label: 'Learn', to: '/learn' }, { label: collection?.title ?? '…' }]"
    >
      <template v-if="videos.length" #actions>
        <UButton icon="i-lucide-play" :to="playLink(nextUp?.videoId)">{{
          watchedCount && nextUp ? 'Continue' : watchedCount === videos.length ? 'Watch again' : 'Start'
        }}</UButton>
        <UButton v-if="videos.length > 1" color="neutral" variant="soft" icon="i-lucide-shuffle" :to="`/collections/${id}/play?shuffle=1`">Shuffle</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />
    <DetailSkeleton v-if="loading" :fields="3" />

    <template v-else-if="collection">
      <UCard class="mb-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 text-sm">
          <span class="font-medium text-gray-900 dark:text-white">{{ watchedCount }} of {{ videos.length }} watched</span>
          <span class="text-gray-500"
            >{{ formatDuration(totalSeconds) }} in total<template v-if="leftSeconds"> · {{ formatDuration(leftSeconds) }} to go</template></span
          >
        </div>
        <UProgress
          :model-value="videos.length ? Math.round((watchedCount / videos.length) * 100) : 0"
          :color="watchedCount === videos.length && videos.length ? 'success' : 'primary'"
          size="sm"
        />
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <EmptyState
          v-if="!videos.length"
          icon="i-lucide-list-video"
          title="Nothing here yet"
          description="Videos will show up once they're added."
          class="py-10"
        />
        <ol v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="(v, i) in videos" :key="v.videoId">
            <NuxtLink :to="playLink(v.videoId)" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <span class="w-6 text-center text-sm tabular-nums text-gray-400">
                <UIcon v-if="progress.get(v.videoId)?.completed" name="i-lucide-circle-check" class="w-5 h-5 text-success-500" aria-label="Watched" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="relative w-28 aspect-video shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" loading="lazy" class="w-full h-full object-cover" />
                <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-5 h-5 text-gray-400" />
                <span
                  v-if="progress.get(v.videoId) && !progress.get(v.videoId)!.completed && progress.get(v.videoId)!.percent"
                  class="absolute bottom-0 left-0 h-1 bg-primary-500"
                  :style="{ width: `${progress.get(v.videoId)!.percent}%` }"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-medium text-gray-900 dark:text-white truncate">{{ v.title ?? `Video #${v.videoId}` }}</span>
                <span class="block text-xs text-gray-500">
                  {{ languageLabel(v.language) }}<template v-if="v.durationSeconds"> · {{ formatDuration(v.durationSeconds) }}</template>
                  <template v-if="v === nextUp && watchedCount"> · up next</template>
                </span>
              </span>
              <UIcon name="i-lucide-play" class="w-4 h-4 text-gray-400" />
            </NuxtLink>
          </li>
        </ol>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
// A course / collection for learners: how far they've got, where to pick up,
// and every video in order. Playing opens the collection player.
import type { Collection, CollectionVideo } from '~/composables/useCollections'
import type { WatchProgress } from '~/composables/useWatchProgress'

const route = useRoute()
const { collection: getCollection } = useLearn()
const { forVideos } = useWatchProgress()

const id = computed(() => Number(route.params.id))
const collection = ref<Collection | null>(null)
const videos = ref<CollectionVideo[]>([])
const progress = ref(new Map<number, WatchProgress>())
const loading = ref(true)
const error = ref('')

const watchedCount = computed(() => videos.value.filter((v) => progress.value.get(v.videoId)?.completed).length)
const nextUp = computed(() => videos.value.find((v) => !progress.value.get(v.videoId)?.completed) ?? null)
const totalSeconds = computed(() => videos.value.reduce((s, v) => s + (v.durationSeconds ?? 0), 0))
const leftSeconds = computed(() => videos.value.filter((v) => !progress.value.get(v.videoId)?.completed).reduce((s, v) => s + (v.durationSeconds ?? 0), 0))
const playLink = (videoId?: number) => `/collections/${id.value}/play${videoId ? `?v=${videoId}` : ''}`

onMounted(async () => {
  try {
    const res = await getCollection(id.value)
    collection.value = res.collection
    videos.value = res.videos
    progress.value = await forVideos(res.videos.map((v) => v.videoId)).catch(() => new Map())
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>
