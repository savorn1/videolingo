<template>
  <USelectMenu
    v-model="model"
    :items="field.options ?? []"
    value-key="value"
    multiple
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :aria-label="field.label ?? field.name"
    class="w-full"
  />
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

// Pick any number of `options`; the model is an array of their values.
defineProps<{ field: FieldDef }>()
const model = defineModel<any[]>()
</script>
