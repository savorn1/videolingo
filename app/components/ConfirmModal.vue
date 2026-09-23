<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer="{ close }">
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="close">Cancel</UButton>
        <UButton :color="color" :loading="loading" @click="emit('confirm')">
          {{ confirmLabel || 'Confirm' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ default: false })

withDefaults(
  defineProps<{
    title: string
    description: string
    confirmLabel?: string
    color?: 'primary' | 'error' | 'neutral' | 'success' | 'warning' | 'info'
    loading?: boolean
  }>(),
  {
    confirmLabel: '',
    color: 'primary',
    loading: false
  }
)

const emit = defineEmits<{ confirm: [] }>()
</script>
