<template>
  <p v-if="!videos.length" class="text-sm text-gray-500">No views in this period.</p>
  <div v-else class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-xs text-gray-500 text-left">
        <tr>
          <th class="pb-2 font-medium">Video</th>
          <th class="pb-2 font-medium text-right">Views</th>
          <th class="pb-2 font-medium text-right">Viewers</th>
          <th class="pb-2 font-medium text-right">Watch time</th>
          <th class="pb-2 font-medium text-right">Finished</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr v-for="v in videos" :key="v.videoId">
          <td class="py-1.5 max-w-xs">
            <NuxtLink :to="`/videos/${v.videoId}`" class="block truncate hover:underline text-gray-900 dark:text-white" :title="v.title">{{
              v.title
            }}</NuxtLink>
          </td>
          <td class="py-1.5 text-right tabular-nums">{{ formatCount(v.views) }}</td>
          <td class="py-1.5 text-right tabular-nums">{{ formatCount(v.uniqueViewers) }}</td>
          <td class="py-1.5 text-right tabular-nums">{{ formatWatchTime(v.watchSeconds) }}</td>
          <td class="py-1.5 text-right tabular-nums">{{ formatPercent(v.completionRate) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { TopVideo } from '~/composables/useAnalytics'

defineProps<{ videos: TopVideo[] }>()
</script>
