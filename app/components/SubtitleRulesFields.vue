<template>
  <div class="space-y-3">
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <UFormField label="Chars / line" :hint="compact ? undefined : 'max'">
        <UInputNumber v-model="rules.maxCharsPerLine" :min="10" :max="100" class="w-full" />
      </UFormField>
      <UFormField label="Lines" :hint="compact ? undefined : 'max'">
        <UInputNumber v-model="rules.maxLines" :min="1" :max="4" class="w-full" />
      </UFormField>
      <UFormField label="Chars / sec" :hint="compact ? undefined : 'max'">
        <UInputNumber v-model="rules.maxCps" :min="1" :max="60" :step="0.5" class="w-full" />
      </UFormField>
      <UFormField label="Min on screen" hint="sec">
        <UInputNumber v-model="minSeconds" :min="0" :max="10" :step="0.1" class="w-full" />
      </UFormField>
      <UFormField label="Max on screen" hint="sec">
        <UInputNumber v-model="maxSeconds" :min="1" :max="60" :step="0.5" class="w-full" />
      </UFormField>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span>{{ summary }}</span>
      <UButton v-if="language" size="xs" color="neutral" variant="link" icon="i-lucide-rotate-ccw" :padded="false" @click="reset">
        Reset to {{ languageLabel(language) }} defaults
      </UButton>
    </div>
    <p v-if="error" class="text-xs text-error-600 dark:text-error-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { SubtitleRules } from '#shared/utils/subtitleQuality'

const rules = defineModel<SubtitleRules>({ required: true })
const props = defineProps<{ language?: string | null; compact?: boolean }>()

// Durations are stored in ms but people think in seconds.
const minSeconds = computed({
  get: () => rules.value.minDurationMs / 1000,
  set: (v: number | null) => (rules.value = { ...rules.value, minDurationMs: Math.round((v ?? 0) * 1000) })
})
const maxSeconds = computed({
  get: () => rules.value.maxDurationMs / 1000,
  set: (v: number | null) => (rules.value = { ...rules.value, maxDurationMs: Math.round((v ?? 1) * 1000) })
})

const summary = computed(() => `Up to ${rules.value.maxLines} × ${rules.value.maxCharsPerLine} characters, read at ≤ ${rules.value.maxCps} characters/second.`)
const error = computed(() => (rules.value.maxDurationMs <= rules.value.minDurationMs ? 'Max on screen must be longer than min on screen.' : ''))

function reset() {
  rules.value = defaultSubtitleRules(props.language)
}
</script>
