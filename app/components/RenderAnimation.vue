<template>
  <div class="flex items-center gap-3" :class="tone.icon" role="img" :aria-label="queued ? 'Waiting to start' : 'Rendering'">
    <!-- Audio edits show a level meter; everything else, a strip of film frames being written one by one -->
    <div v-if="operation === 'AUDIO'" class="flex h-7 items-end gap-[3px]" aria-hidden="true">
      <span
        v-for="n in 7"
        :key="n"
        class="render-bar w-[3px] rounded-full bg-current"
        :class="queued ? 'render-paused' : ''"
        :style="{ animationDelay: `${n * 90}ms` }"
      />
    </div>
    <div v-else class="flex items-center gap-1" aria-hidden="true">
      <span
        v-for="n in 5"
        :key="n"
        class="render-frame h-5 w-7 rounded-[3px] border-2 border-current"
        :class="queued ? 'render-paused' : ''"
        :style="{ animationDelay: `${n * 160}ms` }"
      />
    </div>
    <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ queued ? 'Waiting for its turn…' : label }}</span>
  </div>
</template>

<script setup lang="ts">
// The animation on a running edit: frames lighting up in turn (or a level meter for audio),
// in the colour of the tool that started it. It stands still for people who ask for less motion
// (see main.css) — the percentage and step text next to it carry the same information.
import { TAB_ACCENTS, type EditorTab } from '#shared/utils/tabAccent'

const props = defineProps<{ operation: string; status: string }>()

const TABS: Record<string, EditorTab> = { TRIM: 'trim', SPLIT: 'split', AUDIO: 'audio', OVERLAY: 'overlay', EXTRACT: 'audio' }
const LABELS: Record<string, string> = {
  TRIM: 'Cutting the picture',
  SPLIT: 'Cutting the segments',
  AUDIO: 'Mixing the sound',
  OVERLAY: 'Drawing the layers',
  EXTRACT: 'Pulling out the sound'
}
const queued = computed(() => props.status === 'QUEUED')
const tone = computed(() => TAB_ACCENTS[TABS[props.operation] ?? 'trim'])
const label = computed(() => LABELS[props.operation] ?? 'Rendering')
</script>
