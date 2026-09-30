<template>
  <UCard class="h-full transition-shadow hover:shadow-md" :ui="{ body: 'h-full' }">
    <div class="flex items-start justify-between gap-3 h-full">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate" :title="label">{{ label }}</p>
        <div v-if="loading" class="space-y-2 mt-2">
          <div class="h-8 w-24 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div class="h-3 w-32 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <p v-else class="text-3xl font-semibold text-gray-900 dark:text-white mt-1.5 truncate tabular-nums" :title="value">{{ value }}</p>
        <p v-if="delta && !loading" class="text-xs mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5" :title="deltaTitle">
          <span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium" :class="deltaClass">
            <UIcon :name="deltaIcon" class="w-3.5 h-3.5" />
            {{ delta.text }}
          </span>
          <span class="text-gray-400">{{ comparedTo }}</span>
        </p>
        <p v-if="sublabel && !loading" class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">{{ sublabel }}</p>
        <!-- Sparkline: the shape of the period at a glance, no axes -->
        <svg
          v-if="sparkPoints && !loading"
          class="mt-3 w-full h-8 overflow-visible text-primary-500 dark:text-primary-400"
          viewBox="0 0 100 30"
          preserveAspectRatio="none"
          role="img"
          :aria-label="`Trend over the period, ending at ${value}`"
        >
          <polygon :points="`0,30 ${sparkPoints} 100,30`" fill="currentColor" fill-opacity="0.1" />
          <polyline :points="sparkPoints" fill="none" stroke="currentColor" stroke-width="1.75" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      </div>
      <div class="shrink-0 rounded-xl p-2.5 text-white" :class="[chipClasses, shadowClasses]" aria-hidden="true">
        <UIcon :name="icon" class="w-5 h-5 block" />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { DeltaInfo } from '#shared/utils/analytics'
import type { StatColor } from '#shared/utils/statColor'
import { STAT_GRADIENT_CLASSES, STAT_SHADOW_CLASSES } from '#shared/utils/statColor'

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
    /** The icon chip's colour. Defaults to primary — override for KPIs with a clear semantic read (cost, errors, completion…). */
    color?: StatColor
    loading?: boolean
    /** Values over the period, oldest first; draws a small sparkline under the figure. */
    trend?: number[]
  }>(),
  { delta: null, comparedTo: '', previousText: '', sublabel: '', sentiment: 'up-good', color: 'primary', loading: false, trend: undefined }
)

const sparkPoints = computed(() => {
  const values = props.trend
  if (!values || values.length < 2) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  // 2px inset top and bottom so the stroke isn't clipped at the extremes.
  return values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(' ')
})

const chipClasses = computed(() => STAT_GRADIENT_CLASSES[props.color])
const shadowClasses = computed(() => STAT_SHADOW_CLASSES[props.color])

const good = computed(() => {
  if (!props.delta || props.delta.direction === 'flat' || props.sentiment === 'neutral') return null
  return (props.delta.direction === 'up') === (props.sentiment === 'up-good')
})
const deltaClass = computed(() =>
  good.value === null
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    : good.value
      ? 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400'
      : 'bg-error-50 text-error-700 dark:bg-error-950 dark:text-error-400'
)
const deltaIcon = computed(() =>
  props.delta?.direction === 'up' ? 'i-lucide-trending-up' : props.delta?.direction === 'down' ? 'i-lucide-trending-down' : 'i-lucide-minus'
)
const deltaTitle = computed(() => (props.previousText ? `Previous period: ${props.previousText}` : undefined))
</script>
