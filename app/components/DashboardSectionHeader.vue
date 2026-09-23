<template>
  <div class="flex items-center gap-2 mb-3">
    <UIcon :name="icon" class="size-4 text-primary-400 dark:text-primary-500" />
    <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{{ label }}</h2>
    <div class="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; label: string }>()
</script>
