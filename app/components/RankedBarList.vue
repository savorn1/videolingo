<template>
  <div>
    <p v-if="!rows.length" class="text-sm text-gray-500">{{ empty }}</p>
    <ul v-else class="space-y-2.5">
      <li v-for="r in visible" :key="r.key" class="text-sm">
        <div class="flex items-baseline justify-between gap-2">
          <component :is="r.to ? NuxtLink : 'span'" :to="r.to" class="min-w-0 truncate text-gray-800 dark:text-gray-200" :class="r.to ? 'hover:underline' : ''">
            {{ r.label }}
          </component>
          <span class="font-medium tabular-nums text-gray-900 dark:text-white shrink-0">{{ format(r.value) }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 mt-1 overflow-hidden" aria-hidden="true">
          <div class="h-full rounded-full bg-primary-500 dark:bg-primary-400" :style="{ width: `${max ? (r.value / max) * 100 : 0}%` }" />
        </div>
        <p v-if="r.sub" class="text-xs text-gray-500 mt-0.5 tabular-nums">{{ r.sub }}</p>
      </li>
    </ul>
    <UButton v-if="rows.length > limit" size="xs" color="neutral" variant="link" :padded="false" class="mt-2" @click="expanded = !expanded">
      {{ expanded ? 'Show less' : `Show all ${rows.length}` }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'

export interface RankedRow {
  key: string
  label: string
  value: number
  sub?: string
  to?: string
}

const props = withDefaults(
  defineProps<{
    rows: RankedRow[]
    format?: (value: number) => string
    limit?: number
    empty?: string
  }>(),
  { format: (v: number) => formatCount(v), limit: 8, empty: 'Nothing in this period.' }
)

const expanded = ref(false)
const visible = computed(() => (expanded.value ? props.rows : props.rows.slice(0, props.limit)))
// Bars are relative to the largest row, so the leader always spans the track.
const max = computed(() => Math.max(0, ...props.rows.map((r) => r.value)))
</script>
