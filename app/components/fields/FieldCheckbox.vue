<template>
  <UCheckbox v-model="model" :disabled="field.disabled" :aria-label="field.label ?? field.name" />
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
</script>
