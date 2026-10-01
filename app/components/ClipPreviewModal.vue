<template>
  <UModal v-model:open="open" :title="title" :description="subtitle" :ui="{ content: 'sm:max-w-3xl' }">
    <template #body>
      <div v-if="clip" class="space-y-4">
        <!-- Audio-only results have nothing to show, only to hear -->
        <audio v-if="clip.operation === 'EXTRACT'" :src="clip.url" controls autoplay class="w-full" />
        <video
          v-else
          :key="clip.id"
          :src="clip.url"
          class="aspect-video w-full rounded-lg bg-black object-contain"
          controls
          autoplay
          playsinline
          :poster="poster ?? undefined"
        />

        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div v-for="f in facts" :key="f.label">
            <dt class="text-xs text-gray-500 dark:text-gray-400">{{ f.label }}</dt>
            <dd class="font-medium tabular-nums text-gray-900 dark:text-white">{{ f.value }}</dd>
          </div>
        </dl>

        <p v-if="clip.summary" class="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">{{ clip.summary }}</p>

        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{
            clip.operation === 'EXTRACT'
              ? 'Download it to keep it.'
              : replaces
                ? 'Adding it as a new video keeps your original as it is.'
                : 'Each segment becomes its own new video.'
          }}
          Expires {{ expires }}.
        </p>
      </div>
    </template>

    <template #footer="{ close }">
      <div v-if="clip" class="flex w-full flex-wrap items-center justify-end gap-2">
        <UButton v-if="canWrite" color="error" variant="ghost" icon="i-lucide-trash-2" class="mr-auto" @click="act('discard', close)">Discard</UButton>
        <UButton v-if="clip.operation !== 'EXTRACT' && canCompare" color="neutral" variant="ghost" icon="i-lucide-columns-2" @click="act('compare', close)"
          >Compare</UButton
        >
        <UButton v-if="clip.operation === 'EXTRACT'" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-download" :href="clip.url" download
          >Download</UButton
        >
        <template v-else-if="canWrite">
          <UButton v-if="replaces" color="warning" variant="soft" @click="act('replace', close)">Replace original</UButton>
          <UButton color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-copy-plus" @click="act('addNew', close)">Add as new video</UButton>
        </template>
        <UButton color="neutral" variant="outline" @click="close">Close</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// A result (trim, split segment, audio edit, text overlay, extracted audio) watched or heard
// right on the page, with what was done to it and what can be done next — instead of a link
// that opens the bare file in another tab.
import type { VideoClip } from '~/composables/useVideoEdits'
import { formatDuration, formatFileSize, formatTimeUntil } from '#shared/utils/format'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'

const props = defineProps<{
  clip: VideoClip | null
  /** The wording the page already uses for this result ("Segment 2 · 0:30 – 1:00"). */
  title: string
  canWrite: boolean
  /** Whether promoting would replace the original (trim, audio, text), as opposed to only adding a new video. */
  replaces: boolean
  canCompare: boolean
  poster?: string | null
}>()
const emit = defineEmits<{ addNew: []; replace: []; compare: []; discard: [] }>()
const open = defineModel<boolean>('open', { default: false })

const OPERATIONS: Record<VideoClip['operation'], string> = {
  TRIM: 'Trim',
  SPLIT: 'Split segment',
  AUDIO: 'Video with new audio',
  EXTRACT: 'Extracted audio',
  OVERLAY: 'Text & overlays'
}
const subtitle = computed(() => (props.clip ? OPERATIONS[props.clip.operation] : ''))
const expires = computed(() => (props.clip ? formatTimeUntil(props.clip.expiresAt) : ''))

const facts = computed(() => {
  const c = props.clip
  if (!c) return []
  const out: { label: string; value: string }[] = []
  if (c.durationSeconds != null) out.push({ label: 'Length', value: formatDuration(Math.round(c.durationSeconds)) })
  if (c.operation !== 'EXTRACT' && c.width && c.height) out.push({ label: 'Size', value: `${c.width}×${c.height}` })
  out.push({ label: 'File', value: formatFileSize(c.sizeBytes) })
  if (c.operation === 'TRIM' || c.operation === 'SPLIT') {
    out.push({
      label: 'From',
      value: `${formatDuration(Math.round(c.startMs / 1000))} – ${c.endMs != null ? formatDuration(Math.round(c.endMs / 1000)) : 'end'}`
    })
  }
  if (c.crop) out.push({ label: 'Cropped to', value: `${c.crop.w}×${c.crop.h}` })
  if (c.scale) out.push({ label: 'Resized to', value: `${c.scale.w}×${c.scale.h}` })
  return out
})

// Each action hands over to the page, which already knows how to do it (and asks to confirm where it should).
function act(action: 'addNew' | 'replace' | 'compare' | 'discard', close: () => void) {
  close()
  if (action === 'addNew') emit('addNew')
  else if (action === 'replace') emit('replace')
  else if (action === 'compare') emit('compare')
  else emit('discard')
}
</script>
