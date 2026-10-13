<template>
  <UCard v-if="chapters.length" :ui="{ body: 'p-2 sm:p-2' }" data-testid="chapters">
    <div class="flex items-center justify-between gap-2 px-1 pb-1">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
        <UIcon name="i-lucide-list-video" class="size-4 text-primary-500" />Chapters
      </h3>
      <div class="flex items-center">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-skip-back"
          aria-label="Previous chapter"
          :disabled="prev === null"
          @click="go(prev)"
        />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-skip-forward" aria-label="Next chapter" :disabled="next === null" @click="go(next)" />
      </div>
    </div>
    <ol class="space-y-0.5">
      <li v-for="(c, i) in chapters" :key="c.atMs">
        <button
          type="button"
          class="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
          :class="
            i === current ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-950/40 dark:text-primary-200' : 'text-gray-700 dark:text-gray-300'
          "
          :aria-current="i === current ? 'step' : undefined"
          @click="go(c.atMs)"
        >
          <span class="w-12 shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ formatTimecode(c.atMs) }}</span>
          <span class="min-w-0 flex-1">{{ c.label }}</span>
        </button>
      </li>
    </ol>
  </UCard>
</template>

<script setup lang="ts">
// The video's chapters for learners (markers an editor flagged as chapters): where each starts, the one playing
// highlighted, and previous/next.
import { currentChapterIndex, nextChapterStart, previousChapterStart, type Chapter } from '#shared/utils/chapters'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ chapters: Chapter[]; currentMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const current = computed(() => currentChapterIndex(props.chapters, props.currentMs))
const next = computed(() => nextChapterStart(props.chapters, props.currentMs))
const prev = computed(() => previousChapterStart(props.chapters, props.currentMs))

function go(ms: number | null) {
  if (ms !== null) emit('seek', ms)
}
</script>
