<template>
  <section v-if="items.length" class="mb-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-lucide-history" class="w-4 h-4 text-gray-400" />
        Continue watching
      </h2>
    </div>
    <div class="flex gap-4 overflow-x-auto pb-2 snap-x">
      <VideoCard
        v-for="item in items"
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
