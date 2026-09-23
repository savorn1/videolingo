<template>
  <component :is="to ? NuxtLink : 'div'" :to="to" :class="to ? 'block h-full' : 'h-full'">
    <UCard class="h-full" :ui="{ body: 'h-full' }" :class="to ? 'transition-all hover:shadow-md hover:-translate-y-0.5' : ''">
      <div class="flex items-start justify-between gap-3 h-full">
        <div class="min-w-0">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</p>
          <div v-if="loading" class="h-8 w-24 mt-1.5 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <p v-else class="text-2xl font-semibold text-gray-900 dark:text-white mt-1 truncate">{{ value }}</p>
          <p v-if="sublabel && !loading" class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ sublabel }}</p>
        </div>
        <div class="shrink-0 rounded-xl p-2.5 text-white shadow-sm" :class="colorClasses">
          <UIcon :name="icon" class="w-5 h-5" />
        </div>
      </div>
    </UCard>
  </component>
</template>

<script setup lang="ts">
type StatColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    sublabel?: string
    icon: string
    /** Wraps the tile in a link and adds a hover affordance — omit for a plain, non-interactive tile. */
    to?: string
    color?: StatColor
    /** Shows a skeleton in place of the value — use only for the first load, not on every refresh. */
    loading?: boolean
  }>(),
  { color: 'primary' }
)

// A solid gradient block with a white icon reads as more "alive" than a
// flat tinted tile — each semantic color gets its own two-stop gradient
// rather than a single flat shade, still drawn from the same design-token
// scale (primary/success/warning/error/info/neutral) so it stays consistent
// with the rest of the app's Blueprint palette instead of introducing new
// arbitrary hues.
const COLOR_CLASSES: Record<StatColor, string> = {
  primary: 'bg-gradient-to-br from-primary-400 to-primary-600',
  success: 'bg-gradient-to-br from-success-400 to-success-600',
  warning: 'bg-gradient-to-br from-warning-400 to-warning-600',
  error: 'bg-gradient-to-br from-error-400 to-error-600',
  info: 'bg-gradient-to-br from-info-400 to-info-600',
  neutral: 'bg-gradient-to-br from-gray-400 to-gray-600'
}

const colorClasses = computed(() => COLOR_CLASSES[props.color])

// A string tag name in a dynamic `:is` only resolves for native HTML elements
// — Nuxt's globally-registered components (like NuxtLink) need an explicit
// resolveComponent, or `:is="'NuxtLink'"` silently renders a plain <div>.
const NuxtLink = resolveComponent('NuxtLink')
</script>
