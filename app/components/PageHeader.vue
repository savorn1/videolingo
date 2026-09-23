<template>
  <div>
    <UBreadcrumb v-if="crumbs?.length" :items="crumbs" color="success" class="mb-2" />
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
        <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex items-center gap-2 shrink-0">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'

defineProps<{
  title: string
  description?: string
  crumbs?: BreadcrumbItem[]
}>()
</script>
