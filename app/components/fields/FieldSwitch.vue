<template>
  <div class="flex items-center gap-2">
    <USwitch v-model="model" :disabled="field.disabled" :aria-label="field.label ?? field.name" />
    <span v-if="stateLabel" class="text-sm text-gray-500 dark:text-gray-400">{{ stateLabel }}</span>
  </div>
</template>

<script setup lang="ts">
// Optional on_label/off_label — text next to the toggle for its current state
// (e.g. 'Active'/'Inactive'); the bare toggle still works when neither is set.
import type { FieldDef } from '#shared/types'

const props = defineProps<{ field: FieldDef }>()
const model = defineModel<any>()

const stateLabel = computed(() => (model.value ? props.field.onLabel : props.field.offLabel))
</script>
