<template>
  <UInput
    v-model="model"
    type="date"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :min="field.min !== undefined ? String(field.min) : undefined"
    :max="field.max !== undefined ? String(field.max) : undefined"
    :aria-label="field.label ?? field.name"
    class="w-full"
  />
</template>

<script setup lang="ts">
// Native date input — dependency-free. Value is 'yyyy-MM-dd', which
// formatDate() accepts as-is.
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
</script>
