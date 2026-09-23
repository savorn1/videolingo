<template>
  <UInput
    v-model="model"
    :type="visible ? 'text' : 'password'"
    :icon="field.icon ?? 'i-lucide-lock'"
    :placeholder="field.placeholder"
    :disabled="field.disabled"
    :readonly="field.readonly"
    :required="field.required"
    :aria-label="field.label ?? field.name"
    class="w-full"
  >
    <template #trailing>
      <UButton
        color="neutral"
        variant="link"
        :padded="false"
        :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        @click="visible = !visible"
      />
    </template>
  </UInput>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'

defineProps<{ field: FieldDef }>()
const model = defineModel<any>()
const visible = ref(false)
</script>
