<template>
  <div class="flex items-center gap-3">
    <span class="w-16 shrink-0 text-xs text-gray-500">{{ label }}</span>
    <USlider :model-value="model" :min="min" :max="max" :step="step" class="flex-1" :aria-label="label" @update:model-value="(v) => (model = tidy(Number(v)))" />
    <div class="flex w-24 shrink-0 items-center gap-1">
      <UInput
        :model-value="model"
        type="number"
        size="xs"
        :min="min"
        :max="max"
        :step="step"
        :ui="{ base: 'tabular-nums text-right' }"
        :aria-label="`${label} value`"
        @change="onType"
      >
        <template v-if="unit" #trailing>
          <span class="text-xs text-gray-400">{{ unit }}</span>
        </template>
      </UInput>
      <!-- Always takes its space, so rows don't shift when a value moves off its default -->
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        :aria-label="`Reset ${label} to ${defaultValue}${unit}`"
        :title="`Reset to ${defaultValue}${unit}`"
        :class="changed ? '' : 'invisible'"
        :tabindex="changed ? 0 : -1"
        @click="model = defaultValue"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// A labelled slider with a typed value beside it and a reset back to the
// default. The value is in display units (%, ×, st…); the caller converts.
const props = defineProps<{ label: string; min: number; max: number; step: number; defaultValue: number; unit?: string }>()
const model = defineModel<number>({ required: true })

const changed = computed(() => model.value !== props.defaultValue)

// Steps like 0.05 add up to 1.0500000000000003; keep the step's own precision.
const decimals = computed(() => (String(props.step).split('.')[1] ?? '').length)
const tidy = (v: number) => +v.toFixed(decimals.value)

function onType(event: Event) {
  const input = event.target as HTMLInputElement
  const typed = Number(input.value)
  if (input.value.trim() !== '' && Number.isFinite(typed)) model.value = tidy(Math.min(props.max, Math.max(props.min, typed)))
  // Show what was accepted, or put the old value back.
  input.value = String(model.value)
}
</script>
