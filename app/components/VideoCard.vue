<template>
  <NuxtLink
    :to="to"
    class="group block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition focus-visible:outline-2 focus-visible:outline-primary-500"
  >
    <div class="relative aspect-video bg-gray-100 dark:bg-gray-800 group-hover:scale-[1.02] transition-transform">
      <HoverScrubThumbnail :thumbnail-url="thumbnailUrl" :video-url="videoUrl" :duration-seconds="durationSeconds" />
      <UBadge v-if="progress?.completed" color="success" variant="solid" size="sm" icon="i-lucide-check" class="absolute top-2 right-2">Watched</UBadge>
      <slot name="badge" />
      <!-- How far this user got -->
      <div v-if="progress && !progress.completed && progress.percent" class="absolute inset-x-0 bottom-0 h-1 bg-black/30">
        <div class="h-full bg-primary-500" :style="{ width: `${progress.percent}%` }" />
      </div>
    </div>
    <div class="p-3 space-y-2">
      <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug" :title="title">{{ title }}</h3>
      <slot />
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
// A video as a card: thumbnail, length, title, and — when given — how much of
// it the viewer has watched. Extra details go in the default slot.
import type { WatchProgress } from '~/composables/useWatchProgress'

defineProps<{
  to: string
  title: string
  thumbnailUrl?: string | null
  /** Enables the hover-scrub preview; omitted where the caller doesn't have it (or doesn't want the fetch). */
  videoUrl?: string | null
  durationSeconds?: number | null
  progress?: WatchProgress | null
}>()
</script>
