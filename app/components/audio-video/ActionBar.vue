<template>
  <div class="space-y-4">
    <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />

    <!-- Stays in view while scrolling the long form, and says what is still missing -->
    <div
      class="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
      data-testid="action-bar"
    >
      <div class="mr-auto min-w-0" aria-live="polite">
        <p v-if="blocker" class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <UIcon
            :name="uploadingAny ? 'i-lucide-loader' : 'i-lucide-circle-alert'"
            class="h-4 w-4 shrink-0"
            :class="uploadingAny ? 'animate-spin motion-reduce:animate-none' : 'text-warning-500'"
          />
          {{ blocker }}
        </p>
        <p v-else class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
          <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0 text-success-600 dark:text-success-500" />
          {{ readySummary }}
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">Videos are created hidden. Review each one, then enable it for learners.</p>
      </div>
      <UButton color="neutral" variant="ghost" to="/videos" :disabled="saving">Cancel</UButton>
      <UButton type="submit" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-clapperboard" :loading="saving" :disabled="!canSubmit">{{
        submitLabel
      }}</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// The bottom of "Video from audio": the save error and the bar that stays in view, saying what is still missing.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
const { saveError, saving, uploadingAny, blocker, canSubmit, submitLabel, readySummary } = useAudioToVideoFormContext()
</script>
