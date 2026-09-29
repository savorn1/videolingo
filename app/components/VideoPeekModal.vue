<template>
  <UModal :open="!!video" title="Quick view" :ui="{ content: 'sm:max-w-2xl' }" @update:open="(v: boolean) => !v && emit('close')">
    <template #body>
      <div v-if="video" class="space-y-4">
        <div class="rounded-lg overflow-hidden bg-black">
          <VideoPlayer :video-url="video.videoUrl" :embed-url="video.embedUrl" :poster="video.thumbnailUrl" :title="video.title" read-duration />
        </div>

        <div>
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ video.title }}</h2>
          <p v-if="video.description" class="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-3">{{ video.description }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <UBadge :color="video.enabled ? 'success' : 'neutral'" variant="subtle">{{ video.enabled ? 'Enabled' : 'Disabled' }}</UBadge>
          <UBadge v-if="video.archived" color="warning" variant="subtle">Archived</UBadge>
          <CategoryBadge v-for="c in video.categories" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
          <TagChip v-for="t in video.tags" :key="t.id" :name="t.name" />
        </div>

        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt class="text-gray-500">Duration</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ video.durationSeconds != null ? formatDuration(video.durationSeconds) : '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Language</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ video.language ? languageLabel(video.language) : '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Owner</dt>
            <dd class="font-medium text-gray-900 dark:text-white truncate">{{ video.ownerUsername ?? '—' }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Source</dt>
            <dd class="font-medium text-gray-900 dark:text-white">{{ videoSourceMeta(video.source).label }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Views</dt>
            <dd class="font-medium text-gray-900 dark:text-white tabular-nums">{{ video.viewCount.toLocaleString() }}</dd>
          </div>
          <div>
            <dt class="text-gray-500">Uploaded</dt>
            <dd class="font-medium text-gray-900 dark:text-white" :title="formatDateTime(video.createdAt)">{{ formatRelativeTime(video.createdAt) }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <UButton color="neutral" variant="soft" icon="i-lucide-external-link" :to="`/videos/${video.id}`">Open full page</UButton>
          <UButton v-if="canWrite" color="neutral" variant="soft" icon="i-lucide-pencil" @click="emit('edit', video)">Edit</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// A fast look at a video without leaving the list — the row's already-loaded
// data (no extra fetch), the actual player, and the handful of facts you'd
// open the full page just to check. "Open full page" is still one click away
// for anything this doesn't cover.
import type { Video } from '~/composables/useVideos'

defineProps<{ video: Video | null; canWrite: boolean }>()
const emit = defineEmits<{ close: []; edit: [video: Video] }>()
</script>
