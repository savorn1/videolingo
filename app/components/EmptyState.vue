<template>
  <div class="flex flex-col items-center justify-center text-center py-12 px-4">
    <div
      class="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-teal-100 dark:from-primary-400/10 dark:to-teal-400/10 ring-1 ring-primary-100 dark:ring-primary-400/20 mb-4"
    >
      <UIcon :name="icon" class="w-7 h-7 text-primary-400 dark:text-primary-300" />
    </div>
    <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</p>
    <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  {
    icon: 'i-lucide-sparkles'
  }
)
</script>
