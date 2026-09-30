<template>
  <div>
    <div v-if="!rows.length" class="flex flex-col items-center gap-2 py-6 text-center text-sm text-gray-500">
      <UIcon name="i-lucide-inbox" class="w-7 h-7 text-gray-300 dark:text-gray-600" />
      {{ empty }}
    </div>
    <ul v-else class="space-y-1">
      <li v-for="(r, i) in visible" :key="r.key" class="text-sm rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div class="flex items-baseline justify-between gap-2">
          <div class="flex items-baseline gap-2 min-w-0">
            <span class="w-4 shrink-0 text-xs text-gray-400 tabular-nums text-right">{{ i + 1 }}</span>
            <component :is="r.to ? NuxtLink : 'span'" :to="r.to" class="min-w-0 truncate text-gray-800 dark:text-gray-200" :class="r.to ? 'hover:underline' : ''" :title="r.label">
              {{ r.label }}
            </component>
          </div>
          <div class="flex items-baseline gap-2 shrink-0">
            <span class="text-xs text-gray-400 tabular-nums" :title="'Share of total'">{{ share(r.value) }}</span>
            <span class="font-medium tabular-nums text-gray-900 dark:text-white">{{ format(r.value) }}</span>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 mt-1.5 ml-6 overflow-hidden" aria-hidden="true">
          <div
            class="h-full rounded-full bg-primary-500 dark:bg-primary-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            :style="{ width: `${max ? (r.value / max) * 100 : 0}%` }"
          />
        </div>
        <p v-if="r.sub" class="text-xs text-gray-500 mt-0.5 ml-6 tabular-nums">{{ r.sub }}</p>
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
const total = computed(() => props.rows.reduce((sum, r) => sum + r.value, 0))
function share(value: number) {
  if (!total.value) return ''
  const pct = (value / total.value) * 100
  return pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`
}
</script>
