<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
    <div class="min-w-0">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate" :title="title">{{ title }}</h1>
      <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import { usePageCrumbs } from '~/composables/usePageCrumbs'

const props = defineProps<{
  title: string
  description?: string
  /** Trail from the list page down to this record; shown in the top bar's breadcrumb (see layouts/default.vue). */
  crumbs?: BreadcrumbItem[]
}>()

// Hands the trail to the layout rather than drawing a second breadcrumb here.
const pageCrumbs = usePageCrumbs()
const path = useRoute().path
watchEffect(() => {
  if (props.crumbs?.length) pageCrumbs.value = { path, items: props.crumbs }
})
onBeforeUnmount(() => {
  // The next page may already have set its own trail.
  if (pageCrumbs.value?.path === path) pageCrumbs.value = null
})
</script>
