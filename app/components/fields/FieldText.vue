<template>
  <UInput
    v-model="model"
    type="text"
    :icon="field.icon"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :maxlength="field.maxLength"
    :aria-label="field.label ?? field.name"
    class="w-full"
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
</script>
