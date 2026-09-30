<template>
  <section v-if="items.length" class="mb-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-lucide-history" class="w-4 h-4 text-gray-400" />
        Continue watching
        <span v-if="rest.length" class="text-sm font-normal text-gray-500 dark:text-gray-400">and {{ rest.length }} more</span>
      </h2>
    </div>
    <!-- The one to pick up right now, large, with a clear way back in -->
    <NuxtLink
      v-if="hero"
      :to="`/learn/watch/${hero.progress.videoId}`"
      class="group mb-4 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-primary-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary-500 sm:flex-row dark:border-gray-800 dark:bg-gray-900 dark:hover:border-primary-700"
      data-testid="continue-hero"
    >
      <div class="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-64 md:w-72 dark:bg-gray-800">
        <HoverScrubThumbnail :thumbnail-url="hero.thumbnailUrl" :duration-seconds="hero.videoDurationSeconds ?? hero.progress.durationSeconds" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">Pick up where you left off</p>
        <h3 class="line-clamp-2 text-lg font-semibold leading-snug text-gray-900 dark:text-white" :title="hero.title">{{ hero.title }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ remaining(hero) }} · watched {{ formatRelativeTime(hero.progress.lastWatchedAt) }}</p>
        <div v-if="hero.progress.percent" class="flex items-center gap-2">
          <div
            class="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="progressbar"
            :aria-valuenow="Math.round(hero.progress.percent)"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Watched so far"
          >
            <div class="h-full rounded-full bg-primary-500" :style="{ width: `${hero.progress.percent}%` }" />
          </div>
          <span class="text-xs tabular-nums text-gray-500">{{ Math.round(hero.progress.percent) }}%</span>
        </div>
        <!-- Looks like a button; the whole card is the link, so it can't be a real button inside it -->
        <span class="mt-1 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white group-hover:bg-primary-600">
          <UIcon name="i-lucide-play" class="h-4 w-4" />
          Resume
        </span>
      </div>
    </NuxtLink>
    <div v-if="rest.length" class="flex gap-4 overflow-x-auto pb-2 snap-x">
      <VideoCard
        v-for="item in rest"
        :key="item.progress.videoId"
        :to="`/learn/watch/${item.progress.videoId}`"
        :title="item.title"
        :thumbnail-url="item.thumbnailUrl"
        :duration-seconds="item.videoDurationSeconds ?? item.progress.durationSeconds"
        :progress="item.progress"
        class="w-64 shrink-0 snap-start"
      >
        <p class="text-xs text-gray-500">{{ remaining(item) }} · {{ formatRelativeTime(item.progress.lastWatchedAt) }}</p>
      </VideoCard>
    </div>
  </section>
</template>

<script setup lang="ts">
// Videos the signed-in user started but didn't finish, newest first. Renders
// nothing when there are none.
import type { ContinueItem } from '~/composables/useWatchProgress'

const props = withDefaults(defineProps<{ limit?: number }>(), { limit: 10 })
const { continueWatching } = useWatchProgress()
const items = ref<ContinueItem[]>([])
// The most recent one is shown large; the rest scroll along beneath it.
const hero = computed(() => items.value[0] ?? null)
const rest = computed(() => items.value.slice(1))

function remaining(item: ContinueItem) {
  const total = item.videoDurationSeconds ?? item.progress.durationSeconds
  if (!total) return `at ${formatDuration(item.progress.positionSeconds)}`
  return `${formatDuration(Math.max(0, total - item.progress.positionSeconds))} left`
}

onMounted(async () => {
  try {
    items.value = await continueWatching(props.limit)
  } catch {
    items.value = []
  }
})
</script>
