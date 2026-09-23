<template>
  <UCard :ui="{ body: 'space-y-2.5' }">
    <template #header>
      <h2 class="font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
    </template>
    <p v-if="!rows.length" class="text-sm text-gray-500">No usage in this range.</p>
    <div v-for="r in rows" :key="r.key" class="text-sm">
      <div class="flex items-baseline justify-between gap-2">
        <span class="flex items-center gap-1.5 min-w-0 text-gray-800 dark:text-gray-200">
          <UIcon v-if="icon" :name="icon(r.key)" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span class="truncate" :class="mono ? 'font-mono text-xs' : ''">{{ label ? label(r.key) : r.key }}</span>
        </span>
        <span class="font-medium tabular-nums text-gray-900 dark:text-white">{{ formatUsd(r.costUsd) }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 mt-1 overflow-hidden" aria-hidden="true">
        <div class="h-full rounded-full bg-primary-500 dark:bg-primary-400" :style="{ width: `${share(r.costUsd)}%` }" />
      </div>
      <p class="text-xs text-gray-500 mt-0.5 tabular-nums">
        {{ r.requests }} request{{ r.requests === 1 ? '' : 's' }} · {{ formatTokens(r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens) }} in /
        {{ formatTokens(r.outputTokens) }} out · {{ share(r.costUsd) }}%
      </p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { AiUsageGroup } from '~/composables/useAi'

const props = defineProps<{
  title: string
  rows: AiUsageGroup[]
  label?: (key: string) => string
  icon?: (key: string) => string
  mono?: boolean
}>()

const total = computed(() => props.rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0))

function share(cost: number): number {
  return total.value > 0 ? Math.round(((cost ?? 0) / total.value) * 100) : 0
}
</script>
