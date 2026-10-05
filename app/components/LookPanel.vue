<template>
  <EditorSection v-model:open="open" title="Filter" :changed="!isPlainLook(look)" :hint="describeVideoLook(look) ?? ''" data-testid="look">
    <!-- Each filter as a tile: this video's thumbnail with that filter on it -->
    <div class="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-label="Filters">
      <button
        v-for="t in tiles"
        :key="t.key"
        type="button"
        role="radio"
        :aria-checked="t.on"
        class="group/tile min-w-0 rounded-md p-0.5 text-center focus-visible:outline-2 focus-visible:outline-primary-500"
        :class="t.on ? TAB_ACCENTS.trim.selected : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
        :data-testid="`filter-${t.key}`"
        @click="look = { ...t.look }"
      >
        <span class="relative block aspect-video overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
          <img v-if="thumbnail" :src="thumbnail" alt="" class="size-full object-cover" :style="{ filter: cssFilter(t.look) }" loading="lazy" />
          <span v-else class="block size-full bg-linear-to-br from-sky-300 via-amber-200 to-rose-300" :style="{ filter: cssFilter(t.look) }" />
          <span v-if="warmthTint(t.look)" class="absolute inset-0 mix-blend-soft-light" :style="warmthTint(t.look)!" />
          <span v-if="t.look.vignette" class="absolute inset-0" :style="{ background: VIGNETTE_GRADIENT }" />
        </span>
        <span class="mt-0.5 block truncate text-[11px]" :class="t.on ? 'font-medium text-sky-800 dark:text-sky-200' : 'text-gray-600 dark:text-gray-400'">{{
          t.label
        }}</span>
      </button>
    </div>
    <div v-if="!isPlainLook(look) && !matchingPreset(look)" class="flex items-center justify-between gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">Your own filter</span>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="look = { ...PLAIN_LOOK }">Reset filter</UButton>
    </div>
    <SliderRow
      label="Brightness"
      :model-value="Math.round(look.brightness * 100)"
      :min="-100"
      :max="100"
      :step="5"
      :default-value="0"
      unit="%"
      @update:model-value="(v) => (look = { ...look, brightness: v / 100 })"
    />
    <SliderRow
      label="Contrast"
      :model-value="Math.round(look.contrast * 100)"
      :min="0"
      :max="200"
      :step="5"
      :default-value="100"
      unit="%"
      @update:model-value="(v) => (look = { ...look, contrast: v / 100 })"
    />
    <SliderRow
      label="Colour"
      :model-value="Math.round(look.saturation * 100)"
      :min="0"
      :max="300"
      :step="5"
      :default-value="100"
      unit="%"
      @update:model-value="(v) => (look = { ...look, saturation: v / 100 })"
    />
    <SliderRow
      label="Warmth"
      :model-value="Math.round((look.warmth ?? 0) * 100)"
      :min="-100"
      :max="100"
      :step="5"
      :default-value="0"
      unit="%"
      @update:model-value="(v) => (look = { ...look, warmth: v / 100 })"
    />
    <p class="-mt-1 text-xs text-gray-500 dark:text-gray-400">Left is cooler (blue), right is warmer (orange).</p>
    <SliderRow
      label="Blur"
      :model-value="look.blur"
      :min="0"
      :max="MAX_LOOK_BLUR"
      :step="0.5"
      :default-value="0"
      @update:model-value="(v) => (look = { ...look, blur: v })"
    />
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <USwitch
        :model-value="look.grayscale"
        label="Black & white"
        @update:model-value="(v: boolean) => (look = { ...look, grayscale: v, sepia: v ? false : look.sepia })"
      />
      <USwitch :model-value="look.sepia" label="Sepia" :disabled="look.grayscale" @update:model-value="(v: boolean) => (look = { ...look, sepia: v })" />
      <USwitch :model-value="look.vignette" label="Dark corners" @update:model-value="(v: boolean) => (look = { ...look, vignette: v })" />
      <USwitch :model-value="!!look.sharpen" label="Sharpen" @update:model-value="(v: boolean) => (look = { ...look, sharpen: v })" />
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">The preview is a close match; sharpening shows only in the rendered result.</p>
  </EditorSection>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import {
  LOOK_PRESETS,
  MAX_LOOK_BLUR,
  PLAIN_LOOK,
  VIGNETTE_GRADIENT,
  cssFilter,
  describeVideoLook,
  isPlainLook,
  matchingPreset,
  warmthTint,
  type VideoLook
} from '#shared/utils/videoLook'

/** The video's thumbnail, to show each filter on; a colour sample when there is none. */
defineProps<{ thumbnail?: string | null }>()
const look = defineModel<VideoLook>({ required: true })

// "Original" first, then the presets; the one matching the current filter is ticked.
const tiles = computed(() => [
  { key: 'original', label: 'Original', look: PLAIN_LOOK, on: isPlainLook(look.value) },
  ...LOOK_PRESETS.map((p) => ({ key: p.key, label: p.label, look: p.look, on: matchingPreset(look.value)?.key === p.key }))
])

const open = ref(false)
// A look from a draft or an undo shows up open.
watch(
  () => isPlainLook(look.value),
  (plain) => {
    if (!plain) open.value = true
  },
  { immediate: true }
)
</script>
