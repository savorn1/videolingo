<template>
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
    <UFormField label="Chars / line" :error="err('maxCharsPerLine')">
      <UInputNumber v-model="rules.maxCharsPerLine" :min="10" :max="100" class="w-full" />
    </UFormField>
    <UFormField label="Lines" :error="err('maxLines')">
      <UInputNumber v-model="rules.maxLines" :min="1" :max="4" class="w-full" />
    </UFormField>
    <UFormField label="Min on screen (s)" :error="err('minDurationMs')">
      <UInputNumber v-model="minSeconds" :min="0.2" :max="5" :step="0.1" :format-options="{ maximumFractionDigits: 1 }" class="w-full" />
    </UFormField>
    <UFormField label="Max on screen (s)" :error="err('maxDurationMs')">
      <UInputNumber v-model="maxSeconds" :min="1" :max="20" :step="0.5" :format-options="{ maximumFractionDigits: 1 }" class="w-full" />
    </UFormField>
    <UFormField label="Chars / second" :error="err('maxCps')">
      <UInputNumber v-model="rules.maxCps" :min="5" :max="40" :step="0.5" :format-options="{ maximumFractionDigits: 1 }" class="w-full" />
    </UFormField>
    <p class="col-span-full text-xs text-gray-500">
      Defaults: {{ defaults.maxCharsPerLine }} characters × {{ defaults.maxLines }} lines, {{ defaults.minDurationMs / 1000 }}–{{
        defaults.maxDurationMs / 1000
      }}
      s on screen, {{ defaults.maxCps }} characters per second.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { SubtitleRules } from '#shared/utils/subtitleQuality'

const rules = defineModel<SubtitleRules>({ required: true })
const props = defineProps<{ defaults: SubtitleRules; errors: Record<string, string>; prefix: string }>()

// Stored in ms; people think in seconds.
const minSeconds = computed({
  get: () => rules.value.minDurationMs / 1000,
  set: (v: number) => (rules.value.minDurationMs = Math.round((v ?? 0) * 1000))
})
const maxSeconds = computed({
  get: () => rules.value.maxDurationMs / 1000,
  set: (v: number) => (rules.value.maxDurationMs = Math.round((v ?? 0) * 1000))
})

function err(field: keyof SubtitleRules) {
  return props.errors[`${props.prefix}.${field}`]
}
</script>
