<template>
  <UInput
    v-model="model"
    type="datetime-local"
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
// Native datetime-local input — dependency-free. Value is 'yyyy-MM-ddTHH:mm'
// (no seconds/timezone), which `new Date(...)` and formatDateTime() both
// accept as-is.
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
</script>
