<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    :class="[COLOR_CLASSES[color ?? 'gray'] ?? COLOR_CLASSES.gray, enabled ? '' : 'opacity-60 line-through decoration-1']"
    :title="enabled ? name : `${name} (disabled)`"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    {{ name }}
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; color?: string | null; enabled?: boolean }>(), { color: null, enabled: true })

// Literal class strings so Tailwind generates them (it can't see classes
// assembled from `bg-${color}-100`).
const COLOR_CLASSES: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  lime: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
}
</script>
