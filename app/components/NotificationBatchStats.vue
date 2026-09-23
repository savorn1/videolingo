<template>
  <div class="min-w-40">
    <!-- Stacked delivery bar: sent / pending / failed, 2px gaps between segments -->
    <div class="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800" aria-hidden="true">
      <div v-if="batch.sent" class="bg-success-500" :style="{ width: pct(batch.sent) }" />
      <div v-if="batch.pending" class="bg-warning-400" :style="{ width: pct(batch.pending) }" />
      <div v-if="batch.failed" class="bg-error-500" :style="{ width: pct(batch.failed) }" />
    </div>
    <p class="mt-1 text-xs text-gray-600 dark:text-gray-400 tabular-nums flex flex-wrap gap-x-2">
      <span class="inline-flex items-center gap-0.5"><UIcon name="i-lucide-check" class="w-3 h-3 text-success-600" />{{ batch.sent }} sent</span>
      <span v-if="batch.pending" class="inline-flex items-center gap-0.5"
        ><UIcon name="i-lucide-clock" class="w-3 h-3 text-warning-600" />{{ batch.pending }} pending</span
      >
      <span v-if="batch.failed" class="inline-flex items-center gap-0.5"
        ><UIcon name="i-lucide-circle-x" class="w-3 h-3 text-error-600" />{{ batch.failed }} failed</span
      >
      <span v-if="batch.inApp" class="inline-flex items-center gap-0.5" title="In-app notifications opened by their recipient">
        <UIcon name="i-lucide-eye" class="w-3 h-3 text-gray-400" />{{ batch.read }}/{{ batch.inApp }} read
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { NotificationBatch } from '~/composables/useNotifications'

const props = defineProps<{ batch: NotificationBatch }>()

function pct(n: number) {
  return props.batch.total ? `${(n / props.batch.total) * 100}%` : '0%'
}
</script>
