<template>
  <div class="inline-flex items-center gap-1.5" role="group" aria-label="Animation speed">
    <UIcon name="i-lucide-gauge" class="size-3.5 text-gray-400" aria-hidden="true" />
    <span v-if="label" class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</span>
    <div class="inline-flex rounded-md border border-gray-200 p-0.5 dark:border-gray-800">
      <button
        v-for="s in ANIMATION_SPEEDS"
        :key="s"
        type="button"
        class="rounded px-1.5 py-0.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-primary-500"
        :class="
          speed === s
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200'
            : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/60'
        "
        :aria-pressed="speed === s"
        :title="`Animations at ${formatAnimationSpeed(s)} speed`"
        @click="set(s)"
      >
        {{ formatAnimationSpeed(s) }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// A small speed picker for the page's animations: 0.5×, 1×, 1.5×, 2×. Sits next to whatever is
// animating (the waveform preview, the running jobs). It does nothing for people who ask their
// system for less motion — there the animations don't move at all.
import { ANIMATION_SPEEDS, formatAnimationSpeed } from '#shared/utils/animationSpeed'

defineProps<{ label?: string }>()
const { speed, set } = useAnimationSpeed()
</script>
