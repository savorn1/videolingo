<template>
  <EditorSection
    v-model:open="open"
    title="Blur an area"
    :changed="blurs.length > 0"
    :hint="blurs.length ? `${blurs.length} area${blurs.length === 1 ? '' : 's'}` : ''"
    data-testid="blur-areas"
  >
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Hide a face, a number plate or old burned-in subtitles for the whole clip. Drag the box on the video to move it, its handles to resize.
    </p>
    <ul v-if="blurs.length" class="space-y-1">
      <li
        v-for="(b, i) in blurs"
        :key="i"
        class="flex items-center gap-2 rounded-md px-2 py-1 text-xs"
        :class="editing === i ? TAB_ACCENTS.trim.selected : 'bg-gray-50 dark:bg-gray-900/60'"
      >
        <UIcon name="i-lucide-scan" class="size-3.5 shrink-0" :class="TAB_ACCENTS.trim.icon" />
        <span class="flex-1 tabular-nums">Area {{ i + 1 }} · {{ b.w }}×{{ b.h }} at {{ b.x }}, {{ b.y }}</span>
        <UButton size="xs" color="neutral" variant="ghost" :aria-pressed="editing === i" @click="editing = editing === i ? null : i">
          {{ editing === i ? 'Done' : 'Move / resize' }}
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Remove blurred area ${i + 1}`" @click="remove(i)" />
      </li>
    </ul>
    <UButton
      size="xs"
      color="neutral"
      variant="soft"
      :class="TAB_ACCENTS.trim.soft"
      icon="i-lucide-plus"
      :disabled="blurs.length >= MAX_BLURS || !naturalWidth || !naturalHeight"
      @click="add"
    >
      Add a blurred area
    </UButton>
    <p v-if="error" class="text-xs text-error-600 dark:text-error-400">{{ error }}</p>
    <p v-else-if="editing != null && cropOn" class="text-xs text-gray-500 dark:text-gray-400">The crop box is hidden while you move a blurred area.</p>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Blur an area" group. Boxes are in the original picture's pixels
// (like the crop, which comes after); the one being edited is drawn by CropOverlay in
// its blur mode, the others by ClipExtrasLayer.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { MAX_BLURS, newBlurBox, validateBlurs, type BlurBox } from '#shared/utils/clipExtras'

const props = defineProps<{ naturalWidth: number; naturalHeight: number; cropOn: boolean }>()
const blurs = defineModel<BlurBox[]>({ required: true })
const editing = defineModel<number | null>('editing', { required: true })

const error = computed(() => validateBlurs(blurs.value, props.naturalWidth || null, props.naturalHeight || null))

function add() {
  blurs.value = [...blurs.value, newBlurBox(props.naturalWidth, props.naturalHeight)]
  editing.value = blurs.value.length - 1
}
function remove(i: number) {
  blurs.value = blurs.value.filter((_, j) => j !== i)
  editing.value = null
}

const open = ref(false)
watch(
  () => blurs.value.length > 0,
  (on) => on && (open.value = true),
  { immediate: true }
)
</script>
