<template>
  <UModal :open="!!version" :title="version?.note ?? 'Prior version'" :ui="{ content: 'sm:max-w-3xl' }" @update:open="(v: boolean) => !v && emit('close')">
    <template #body>
      <div v-if="version" class="space-y-4">
        <div class="relative w-full overflow-hidden rounded-lg bg-black" :class="vertical ? 'aspect-[9/16] h-[min(60vh,560px)] mx-auto' : 'aspect-video'">
          <video
            ref="el"
            :key="version.url"
            :src="version.url"
            class="absolute inset-0 w-full h-full object-contain"
            controls
            playsinline
            preload="metadata"
            autoplay
            @error="failed = true"
          />
          <div v-if="failed" class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black p-6 text-center text-white/80" role="alert">
            <UIcon name="i-lucide-circle-alert" class="w-8 h-8" />
            <p class="font-semibold">This version can't be played here</p>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-external-link" :to="version.url" target="_blank">Open file URL</UButton>
          </div>
        </div>

        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">Size</dt>
            <dd class="font-medium tabular-nums">{{ version.fileSize === null ? '—' : formatFileSize(version.fileSize) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">Length</dt>
            <dd class="font-medium tabular-nums">{{ version.durationSeconds ? formatDuration(version.durationSeconds) : '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">Resolution</dt>
            <dd class="font-medium tabular-nums">{{ version.width && version.height ? `${version.width}×${version.height}` : '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs text-gray-500 dark:text-gray-400">Saved</dt>
            <dd class="font-medium" :title="formatDateTime(version.createdAt)">
              {{ formatRelativeTime(version.createdAt) }}<template v-if="version.createdBy"> · {{ version.createdBy }}</template>
            </dd>
          </div>
        </dl>
      </div>
    </template>
    <template #footer>
      <div v-if="version" class="flex flex-wrap justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" @click="emit('close')">Close</UButton>
        <UButton v-if="canCompare" color="neutral" variant="soft" icon="i-lucide-columns-2" @click="emit('compare', version)">Compare with current</UButton>
        <UButton v-if="canWrite" icon="i-lucide-rotate-ccw" @click="emit('restore', version)">Restore this version</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Plays a prior version in the page, so it can be looked over (and restored or
// compared) without opening the raw file in another tab.
import type { VideoVersion } from '~/composables/useVideoVersions'

const props = defineProps<{ version: VideoVersion | null; canWrite: boolean; canCompare: boolean }>()
const emit = defineEmits<{ close: []; compare: [version: VideoVersion]; restore: [version: VideoVersion] }>()

const failed = ref(false)
const vertical = computed(() => !!props.version?.width && !!props.version?.height && props.version.height > props.version.width)
watch(
  () => props.version?.id,
  () => (failed.value = false)
)
</script>
