<template>
  <!-- Effect: one per clip -->
  <EditorSection v-model:open="effectOpen" title="Effect" :changed="effect !== 'NONE'" :hint="describeEffect(effect) ?? ''" data-testid="clip-effect">
    <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Effect">
      <button
        v-for="e in VIDEO_EFFECTS"
        :key="e.value"
        type="button"
        role="radio"
        :aria-checked="effect === e.value"
        :title="e.hint"
        class="flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-primary-500"
        :class="
          effect === e.value
            ? TAB_ACCENTS.trim.selected + ' border-transparent font-medium text-sky-800 dark:text-sky-200'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/50'
        "
        @click="effect = e.value"
      >
        <UIcon :name="e.icon" class="size-4" :class="effect === e.value ? TAB_ACCENTS.trim.icon : ''" />
        {{ e.label }}
      </button>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">{{ effectHint }}</p>
  </EditorSection>

  <!-- Transition: fade in at the start, fade out at the end -->
  <EditorSection v-model:open="fadeOpen" title="Transition" :changed="!isNoFade(fade)" :hint="describeFade(fade) ?? ''" data-testid="clip-fade">
    <SliderRow
      label="Fade in"
      :model-value="fade.inMs / 1000"
      :min="0"
      :max="MAX_FADE_MS / 1000"
      :step="0.25"
      :default-value="0"
      unit="s"
      @update:model-value="(v) => (fade = { ...fade, inMs: Math.round(v * 1000) })"
    />
    <SliderRow
      label="Fade out"
      :model-value="fade.outMs / 1000"
      :min="0"
      :max="MAX_FADE_MS / 1000"
      :step="0.25"
      :default-value="0"
      unit="s"
      @update:model-value="(v) => (fade = { ...fade, outMs: Math.round(v * 1000) })"
    />
    <div class="flex flex-wrap items-center gap-1">
      <span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Fade through</span>
      <UButton
        v-for="c in COLORS"
        :key="c.value"
        size="xs"
        color="neutral"
        :variant="fade.color === c.value ? 'soft' : 'ghost'"
        :class="fade.color === c.value ? TAB_ACCENTS.trim.soft : ''"
        :aria-pressed="fade.color === c.value"
        @click="fade = { ...fade, color: c.value }"
      >
        <span class="size-3 rounded-full border border-gray-300 dark:border-gray-600" :class="c.swatch" aria-hidden="true" />
        {{ c.label }}
      </UButton>
      <UButton v-if="!isNoFade(fade)" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" class="ml-auto" @click="fade = { ...NO_FADE }"
        >No fade</UButton
      >
    </div>
    <p class="text-xs" :class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'">
      {{ error ?? 'The picture and the sound fade together. Play the start or end of the range to see it.' }}
    </p>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's Effect and Transition groups. Both go out with the trim request
// (and with each multi-format export); the backend renders them.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import {
  MAX_FADE_MS,
  NO_FADE,
  VIDEO_EFFECTS,
  describeEffect,
  describeFade,
  isNoFade,
  validateFade,
  type ClipFade,
  type VideoEffect
} from '#shared/utils/videoEffects'

const props = defineProps<{ lengthMs: number }>()
const effect = defineModel<VideoEffect>('effect', { required: true })
const fade = defineModel<ClipFade>('fade', { required: true })

const COLORS = [
  { value: 'BLACK' as const, label: 'Black', swatch: 'bg-black' },
  { value: 'WHITE' as const, label: 'White', swatch: 'bg-white' }
]

const error = computed(() => validateFade(fade.value, props.lengthMs || null))
const effectHint = computed(() => VIDEO_EFFECTS.find((e) => e.value === effect.value)?.hint ?? '')

// Folded until used; settings from a draft or an undo show up open.
const effectOpen = ref(false)
const fadeOpen = ref(false)
watch(
  () => effect.value !== 'NONE',
  (on) => on && (effectOpen.value = true),
  { immediate: true }
)
watch(
  () => !isNoFade(fade.value),
  (on) => on && (fadeOpen.value = true),
  { immediate: true }
)
</script>
