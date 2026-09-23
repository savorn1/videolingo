<template>
  <UInput
    :model-value="displayValue"
    type="text"
    inputmode="decimal"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :aria-label="field.label ?? field.name"
    class="w-full"
    @focus="focused = true"
    @blur="focused = false"
    @update:model-value="onInput"
  >
    <template #leading>
      <span class="text-gray-500 dark:text-gray-400 text-sm">{{ field.prefix ?? '$' }}</span>
    </template>
    <template v-if="field.suffix" #trailing>
      <span class="text-gray-500 dark:text-gray-400 text-sm">{{ field.suffix }}</span>
    </template>
  </UInput>
</template>

<script setup lang="ts">
// Same numeric model as FieldNumber (a real number, '' clears to undefined) but
// displays thousands-formatted ('1,000.00') while blurred and a plain editable
// number while focused, so typing isn't disrupted by commas inserted mid-edit.
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()

const focused = ref(false)

const displayValue = computed(() => {
  if (model.value === undefined || model.value === null || model.value === '') return ''
  if (focused.value) return String(model.value)
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(model.value))
})

function onInput(value: string | number) {
  const cleaned = String(value).replace(/,/g, '')
  model.value = cleaned === '' ? undefined : Number(cleaned)
}
</script>
