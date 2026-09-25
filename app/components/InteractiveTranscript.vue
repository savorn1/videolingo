<template>
  <div ref="root" class="max-h-[70vh] overflow-y-auto">
    <p v-if="!cues.length" class="p-4 text-sm text-gray-500">No subtitles for this video yet.</p>
    <ol v-else class="divide-y divide-gray-100 dark:divide-gray-800">
      <li
        v-for="(cue, i) in cues"
        :key="i"
        :data-cue="i"
        class="flex gap-3 px-4 py-2.5 transition-colors"
        :class="i === active ? 'bg-primary-50 dark:bg-primary-950/40' : ''"
      >
        <button
          type="button"
          class="shrink-0 w-12 pt-0.5 text-left font-mono text-[11px] tabular-nums text-primary-600 dark:text-primary-400 hover:underline"
          :aria-label="`Play from ${formatTimestamp(cue.startMs)}`"
          @click="emit('seek', cue.startMs)"
        >
          {{ formatDuration(cue.startMs / 1000) }}
        </button>
        <div class="min-w-0 flex-1">
          <p class="text-sm leading-relaxed text-gray-900 dark:text-white whitespace-pre-line">
            <template v-for="(piece, k) in pieces[i]" :key="k">
              <button
                v-if="piece.word"
                type="button"
                class="rounded px-px hover:bg-primary-100 dark:hover:bg-primary-900/50 focus-visible:bg-primary-100 focus-visible:outline-none cursor-help"
                :title="`Look up “${piece.text}”`"
                @click="emit('lookup', { word: piece.text, context: cue.text, atMs: cue.startMs })"
              >
                {{ piece.text }}</button
              ><template v-else>{{ piece.text }}</template>
            </template>
          </p>
          <p v-if="secondaryTextAt(cue)" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">{{ secondaryTextAt(cue) }}</p>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
// A video's subtitles as a readable, clickable transcript: follows the video,
// jumps to a line when its time is clicked, and lets every word be looked up.
// A second track (a translation) can be shown under each line.
import type { LearnCue } from '~/composables/useLearn'

const props = defineProps<{
  cues: LearnCue[]
  language?: string | null
  secondaryCues?: LearnCue[]
  currentMs: number
  /** Keep the current line in view (off while the viewer scrolls around). */
  follow?: boolean
}>()
const emit = defineEmits<{ seek: [ms: number]; lookup: [{ word: string; context: string; atMs: number }] }>()

const root = ref<HTMLElement | null>(null)
const pieces = computed(() => props.cues.map((c) => splitWords(c.text, props.language)))
const active = computed(() => activeCueIndex(props.cues, props.currentMs))

// The translation line shown under a cue: whichever second-track cue overlaps its middle.
function secondaryTextAt(cue: LearnCue) {
  if (!props.secondaryCues?.length) return ''
  const mid = (cue.startMs + cue.endMs) / 2
  return props.secondaryCues.find((c) => c.startMs <= mid && mid < c.endMs)?.text ?? ''
}

watch(active, (i) => {
  if (i < 0 || props.follow === false || !root.value) return
  const el = root.value.querySelector<HTMLElement>(`[data-cue="${i}"]`)
  if (!el) return
  // Scroll only the transcript, never the page.
  const top = el.offsetTop - root.value.clientHeight / 3
  root.value.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
})
</script>
