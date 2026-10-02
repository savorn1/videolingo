<template>
  <div class="space-y-1.5">
    <div class="flex items-center gap-2">
      <UProgress :model-value="Math.round(result.score * 100)" :color="color" size="sm" class="flex-1" />
      <span class="text-sm font-semibold tabular-nums" :class="textColor">{{ Math.round(result.score * 100) }}%</span>
    </div>
    <p class="leading-relaxed" data-testid="diff-tokens">
      <template v-for="(t, i) in result.tokens" :key="i">
        <span v-if="t.status === 'ok'" class="text-success-600 dark:text-success-400">{{ t.text }}</span>
        <span v-else-if="t.status === 'wrong'" class="inline-flex flex-col items-center align-top leading-tight">
          <span class="text-error-600 dark:text-error-400 line-through">{{ t.text }}</span>
          <span class="text-xs text-success-700 dark:text-success-300">{{ t.expected }}</span>
        </span>
        <span v-else-if="t.status === 'missing'" class="text-gray-500 underline decoration-dotted dark:text-gray-400" :title="`Missing: ${t.text}`">{{
          t.text
        }}</span>
        <span v-else class="text-error-600 dark:text-error-400 line-through opacity-70" :title="`Not in the line: ${t.text}`">{{ t.text }}</span>
        {{ ' ' }}
      </template>
    </p>
    <p class="text-xs text-gray-500">
      {{ result.correct }} of {{ result.total }} right · <span class="text-success-600 dark:text-success-400">right</span> ·
      <span class="text-error-600 dark:text-error-400 line-through">wrong</span> (with the right word under it) ·
      <span class="text-gray-500 underline decoration-dotted dark:text-gray-400">missing</span>
    </p>
  </div>
</template>

<script setup lang="ts">
// One diffWords result: a score bar, then the answer word by word.
import type { DiffResult } from '#shared/utils/wordDiff'

const props = defineProps<{ result: DiffResult }>()
const color = computed(() => (props.result.score >= 0.9 ? 'success' : props.result.score >= 0.6 ? 'warning' : 'error'))
const textColor = computed(() => ({ success: 'text-success-600', warning: 'text-warning-600', error: 'text-error-600' })[color.value])
</script>
