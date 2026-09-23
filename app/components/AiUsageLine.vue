<template>
  <p v-if="usage" class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
    <span class="font-mono">{{ usage.model ?? '—' }}</span>
    <UBadge v-if="usage.fallbackFrom" color="warning" variant="subtle" size="sm" :title="`${usage.fallbackFrom} declined; answered by the fallback model`">
      fallback
    </UBadge>
    <span>·</span>
    <span :title="tokenTitle">{{ formatTokens(totalInput) }} in / {{ formatTokens(usage.outputTokens) }} out</span>
    <template v-if="usage.cacheReadTokens">
      <span>·</span>
      <span title="Input tokens served from the prompt cache (billed at 10%)">{{ formatTokens(usage.cacheReadTokens) }} cached</span>
    </template>
    <span>·</span>
    <span class="font-medium text-gray-700 dark:text-gray-300">{{ formatUsd(usage.costUsd) }}</span>
    <template v-if="usage.latencyMs !== null">
      <span>·</span>
      <span>{{ (usage.latencyMs / 1000).toFixed(1) }}s</span>
    </template>
  </p>
</template>

<script setup lang="ts">
import type { AiUsage } from '~/composables/useAi'

const props = defineProps<{ usage: AiUsage | null }>()

const totalInput = computed(() => (props.usage ? props.usage.inputTokens + props.usage.cacheWriteTokens + props.usage.cacheReadTokens : 0))
const tokenTitle = computed(() => {
  const u = props.usage
  if (!u) return ''
  return `Input ${u.inputTokens} · cache write ${u.cacheWriteTokens} · cache read ${u.cacheReadTokens} · output ${u.outputTokens}`
})
</script>
