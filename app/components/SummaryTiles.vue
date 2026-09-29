<template>
  <div class="grid gap-3 mb-4" :class="GRID_CLASS[tiles.length] ?? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'">
    <button
      v-for="t in tiles"
      :key="t.key"
      type="button"
      class="flex items-start gap-3 text-left rounded-lg border p-3 transition-colors"
      :class="
        t.active
          ? ACTIVE_CLASSES[t.color ?? 'neutral']
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
      "
      :aria-pressed="t.active"
      @click="emit('select', t.key)"
    >
      <div v-if="t.icon" class="shrink-0 rounded-lg p-2 text-white" :class="[CHIP_CLASSES[t.color ?? 'neutral'], SHADOW_CLASSES[t.color ?? 'neutral']]">
        <UIcon :name="t.icon" class="w-4 h-4 block" />
      </div>
      <div class="min-w-0">
        <div class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ t.label }}</div>
        <!-- A div, not a <p>: the skeleton is a block element, and a div inside
             a <p> is invalid HTML that the browser re-parses, which breaks hydration. -->
        <div class="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
          <USkeleton v-if="t.count == null" class="h-7 w-10" />
          <template v-else>{{ t.count.toLocaleString() }}</template>
        </div>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
// A row of tiles that are both a summary ("how many of each") and a
// one-click filter — the pattern Processing Jobs already used for its
// status tiles, generalised so any list page can drop it in without
// duplicating the layout, skeleton and active/hover styling each time.
// The caller decides what each tile counts and does about a click; this
// only renders and reports which key was clicked.
//
// The colour lives on a gradient icon chip, not the number — same split
// StatTile already uses (a flat grid of monochrome numbers reads as inert;
// a coloured chip per tile reads as alive without making the metric itself
// look like a warning when it isn't one).
import type { StatColor } from '#shared/utils/statColor'
import { STAT_GRADIENT_CLASSES, STAT_SHADOW_CLASSES } from '#shared/utils/statColor'

export type TileColor = StatColor

export interface SummaryTile {
  key: string
  label: string
  /** null while loading — shows a skeleton instead of a number. */
  count: number | null
  icon?: string
  /** Highlights the tile as the active filter. */
  active: boolean
  /** The icon chip's colour, and the active-state tint. Defaults to neutral. */
  color?: TileColor
}
defineProps<{ tiles: SummaryTile[] }>()
const emit = defineEmits<{ select: [key: string] }>()

// Literal, complete class strings — Tailwind's build-time scan needs to see
// these written out, not assembled from a template string.
const GRID_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 sm:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
}
const CHIP_CLASSES = STAT_GRADIENT_CLASSES
const SHADOW_CLASSES = STAT_SHADOW_CLASSES
const ACTIVE_CLASSES: Record<TileColor, string> = {
  primary: 'border-primary-500 ring-1 ring-primary-500 bg-primary-50 dark:bg-primary-950/40',
  success: 'border-success-500 ring-1 ring-success-500 bg-success-50 dark:bg-success-950/40',
  warning: 'border-warning-500 ring-1 ring-warning-500 bg-warning-50 dark:bg-warning-950/40',
  error: 'border-error-500 ring-1 ring-error-500 bg-error-50 dark:bg-error-950/40',
  info: 'border-info-500 ring-1 ring-info-500 bg-info-50 dark:bg-info-950/40',
  neutral: 'border-gray-400 dark:border-gray-500 ring-1 ring-gray-400 dark:ring-gray-500 bg-gray-50 dark:bg-gray-800/40'
}
</script>
