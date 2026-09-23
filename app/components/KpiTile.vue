<template>
  <UCard class="h-full">
    <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
      <UIcon :name="icon" class="w-4 h-4" />
      {{ label }}
    </p>
    <div v-if="loading" class="h-8 w-24 mt-1.5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
    <p v-else class="text-2xl font-semibold text-gray-900 dark:text-white mt-1 truncate tabular-nums">{{ value }}</p>
    <p v-if="delta && !loading" class="text-xs mt-1 flex items-center gap-1" :class="deltaClass" :title="deltaTitle">
      <UIcon :name="deltaIcon" class="w-3.5 h-3.5" />
      <span class="font-medium">{{ delta.text }}</span>
      <span class="text-gray-400">{{ comparedTo }}</span>
    </p>
    <p v-if="sublabel && !loading" class="text-xs text-gray-500 mt-1">{{ sublabel }}</p>
  </UCard>
</template>

<script setup lang="ts">
import type { DeltaInfo } from '#shared/utils/analytics'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    icon: string
    delta?: DeltaInfo | null
    /** "vs previous 30 days" */
    comparedTo?: string
    /** Previous-period value, shown on hover. */
    previousText?: string
    sublabel?: string
    /** How to colour a change: a rise is good news, bad news (cost…), or neither. */
    sentiment?: 'up-good' | 'up-bad' | 'neutral'
    loading?: boolean
  }>(),
  { delta: null, comparedTo: '', previousText: '', sublabel: '', sentiment: 'up-good', loading: false }
)

const good = computed(() => {
  if (!props.delta || props.delta.direction === 'flat' || props.sentiment === 'neutral') return null
  return (props.delta.direction === 'up') === (props.sentiment === 'up-good')
})
const deltaClass = computed(() =>
  good.value === null ? 'text-gray-500' : good.value ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'
)
const deltaIcon = computed(() =>
  props.delta?.direction === 'up' ? 'i-lucide-trending-up' : props.delta?.direction === 'down' ? 'i-lucide-trending-down' : 'i-lucide-minus'
)
const deltaTitle = computed(() => (props.previousText ? `Previous period: ${props.previousText}` : undefined))
</script>
