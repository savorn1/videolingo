<template>
  <EditorSection v-model:open="open" title="Save as GIF or picture" data-testid="frame-export">
    <p class="text-xs text-gray-500 dark:text-gray-400">For previews and social posts. These are files to download — they appear under Results.</p>
    <div class="flex flex-wrap items-center gap-1.5">
      <UButton
        v-if="canWrite"
        size="xs"
        color="neutral"
        variant="soft"
        :class="TAB_ACCENTS.trim.soft"
        icon="i-lucide-image-play"
        :loading="starting === 'gif'"
        :disabled="!!gifError || busy || !!starting"
        data-testid="make-gif"
        @click="emit('gif', width)"
      >
        GIF of the range ({{ formatTimecode(rangeEndMs - rangeStartMs) }})
      </UButton>
      <USelect v-model="width" :items="widthItems" size="xs" class="w-24" aria-label="GIF width" />
    </div>
    <p v-if="gifError" class="text-xs text-gray-500 dark:text-gray-400">{{ gifError }}</p>
    <UButton
      v-if="canWrite"
      size="xs"
      color="neutral"
      variant="soft"
      :class="TAB_ACCENTS.trim.soft"
      icon="i-lucide-image"
      :loading="starting === 'still'"
      :disabled="busy || !!starting || !durationMs"
      data-testid="make-still"
      @click="emit('still')"
    >
      Picture of the frame at {{ formatTimecode(currentMs) }}
    </UButton>
    <p v-if="busy" class="text-xs text-gray-500 dark:text-gray-400">{{ BUSY_NOTE }}</p>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Save as GIF or picture" group: a looping GIF of the trim range
// (at most 15 s) or a JPG of the frame at the playhead — download-only results.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { formatTimecode } from '#shared/utils/transport'
import { BUSY_NOTE, GIF_WIDTHS, validateGif } from '#shared/utils/videoEdit'

const props = defineProps<{
  currentMs: number
  rangeStartMs: number
  rangeEndMs: number
  durationMs: number
  canWrite: boolean
  busy: boolean
  starting: 'gif' | 'still' | null
}>()
const emit = defineEmits<{ gif: [width: number]; still: [] }>()

const width = ref(480)
const widthItems = GIF_WIDTHS.map((w) => ({ label: `${w} px`, value: w }))
const gifError = computed(() => validateGif(Math.round(props.rangeStartMs), Math.round(props.rangeEndMs), Math.round(props.durationMs) || null))
const open = ref(false)
</script>
