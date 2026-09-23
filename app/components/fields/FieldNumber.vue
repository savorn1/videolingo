<template>
  <UInput
    :model-value="model"
    type="number"
    :icon="field.icon"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :min="field.min"
    :max="field.max"
    :step="field.step"
    :aria-label="field.label ?? field.name"
    class="w-full"
    @update:model-value="onInput"
  >
    <template v-if="field.prefix" #leading>
      <span class="text-gray-500 dark:text-gray-400 text-sm">{{ field.prefix }}</span>
    </template>
    <template v-if="field.suffix" #trailing>
      <span class="text-gray-500 dark:text-gray-400 text-sm">{{ field.suffix }}</span>
    </template>
  </UInput>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()

// Emits real numbers (empty clears to undefined) so the bound model matches
// numeric DTO fields without a .number modifier upstream.
function onInput(value: string | number) {
  model.value = value === '' ? undefined : Number(value)
}
</script>
