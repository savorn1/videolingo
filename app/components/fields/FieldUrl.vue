<template>
  <UInput
    v-model="model"
    type="url"
    :icon="field.icon ?? 'i-lucide-link'"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :aria-label="field.label ?? field.name"
    class="w-full"
  />
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
</script>
