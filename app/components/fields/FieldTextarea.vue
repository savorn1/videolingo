<template>
  <UTextarea
    v-model="model"
    :rows="field.rows ?? 3"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :aria-label="field.label ?? field.name"
    class="w-full"
  />
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
</script>
