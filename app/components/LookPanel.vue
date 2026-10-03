<template>
  <EditorSection v-model:open="open" title="Look" :changed="!isPlainLook(look)" :hint="describeVideoLook(look) ?? ''" data-testid="look">
    <div class="flex flex-wrap gap-1" role="group" aria-label="Looks">
      <UButton
        v-for="p in LOOK_PRESETS"
        :key="p.key"
        size="xs"
        color="neutral"
        :variant="matchingPreset(look)?.key === p.key ? 'soft' : 'outline'"
        :aria-pressed="matchingPreset(look)?.key === p.key"
        @click="look = { ...p.look }"
      >
        {{ p.label }}
      </UButton>
      <UButton v-if="!isPlainLook(look)" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="look = { ...PLAIN_LOOK }"
        >Reset look</UButton
      >
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
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">The preview is a close match; dark corners show only in the rendered result.</p>
  </EditorSection>
</template>

<script setup lang="ts">
import { LOOK_PRESETS, MAX_LOOK_BLUR, PLAIN_LOOK, describeVideoLook, isPlainLook, matchingPreset, type VideoLook } from '#shared/utils/videoLook'

const look = defineModel<VideoLook>({ required: true })

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
