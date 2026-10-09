<template>
  <UCard :id="`step-${step}`" class="scroll-mt-4" :class="tone.scope" :ui="{ header: tone.header }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="tone.badge" aria-hidden="true">{{
            step
          }}</span>
          {{ title }}
          <UIcon v-if="done" name="i-lucide-circle-check" class="h-4 w-4 text-success-600 dark:text-success-500" aria-label="Done" />
        </h2>
        <slot name="aside" />
      </div>
    </template>
    <slot />
  </UCard>
</template>

<script setup lang="ts">
// One numbered step of "Video from audio". Each step has its own colour (shared with the editor's
// tabs): a numbered badge, a tinted header, and — through the scope class — its own accent for the
// selected buttons, switches and focus rings inside the card.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'

const props = defineProps<{ step: 1 | 2 | 3 | 4; title: string; done?: boolean }>()

const TONES = {
  1: { scope: TAB_ACCENTS.audio.scope, badge: TAB_ACCENTS.audio.button, header: 'bg-emerald-50/70 dark:bg-emerald-950/30' },
  2: { scope: TAB_ACCENTS.split.scope, badge: TAB_ACCENTS.split.button, header: 'bg-violet-50/70 dark:bg-violet-950/30' },
  3: { scope: TAB_ACCENTS.trim.scope, badge: TAB_ACCENTS.trim.button, header: 'bg-sky-50/70 dark:bg-sky-950/30' },
  4: { scope: TAB_ACCENTS.join.scope, badge: TAB_ACCENTS.join.button, header: 'bg-orange-50/70 dark:bg-orange-950/30' }
} as const
const tone = computed(() => TONES[props.step])
</script>
