<template>
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"> Showing {{ shownCount }} of {{ total }} </span>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:text-gray-300 dark:disabled:text-gray-600 focus-visible:outline-2 focus-visible:outline-primary-500 dark:focus-visible:outline-primary-400 focus-visible:outline-offset-1"
          :disabled="page <= 1"
          @click="page = page - 1"
        >
          <UIcon name="i-lucide-chevron-left" class="w-4 h-4" />
          Previous
        </button>

        <template v-for="(item, i) in pageItems" :key="i">
          <span v-if="item === 'ellipsis'" class="px-1.5 text-sm text-gray-500 dark:text-gray-400 select-none">…</span>
          <button
            v-else
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary-500 dark:focus-visible:outline-primary-400 focus-visible:outline-offset-1"
            :class="
              item === page
                ? 'bg-primary-500 text-white dark:bg-primary-400 dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            "
            @click="page = item"
          >
            {{ item }}
          </button>
        </template>

        <button
          type="button"
          class="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 disabled:pointer-events-none disabled:text-gray-300 dark:disabled:text-gray-600 focus-visible:outline-2 focus-visible:outline-primary-500 dark:focus-visible:outline-primary-400 focus-visible:outline-offset-1"
          :disabled="page >= pageCount"
          @click="page = page + 1"
        >
          Next
          <UIcon name="i-lucide-chevron-right" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <USelect v-model="pageSize" :items="pageSizeOptions" size="sm" class="w-20" />
      <span class="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">per page</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    total: number
    pageSizeOptions?: { label: string; value: number }[]
  }>(),
  {
    pageSizeOptions: () => [10, 15, 25, 50].map((n) => ({ label: String(n), value: n }))
  }
)

const page = defineModel<number>('page', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / pageSize.value)))

const shownCount = computed(() => {
  if (props.total === 0) return 0
  const start = (page.value - 1) * pageSize.value
  return Math.min(pageSize.value, props.total - start)
})

type PageItem = number | 'ellipsis'
const pageItems = computed<PageItem[]>(() => {
  const count = pageCount.value
  const current = page.value
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)

  const items: PageItem[] = [1]
  if (current > 3) items.push('ellipsis')
  for (let p = Math.max(2, current - 1); p <= Math.min(count - 1, current + 1); p++) items.push(p)
  if (current < count - 2) items.push('ellipsis')
  items.push(count)
  return items
})
</script>
