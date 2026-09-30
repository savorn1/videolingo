<template>
  <details :open="open" class="group border-t border-gray-100 dark:border-gray-800 pt-3" @toggle="onToggle">
    <summary
      class="flex cursor-pointer list-none items-center gap-2 rounded select-none focus-visible:outline-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden"
    >
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ title }}</h3>
      <span v-if="changed" class="size-1.5 shrink-0 rounded-full bg-warning-500" role="img" aria-label="Has changes" title="Has changes" />
      <span v-if="hint" class="min-w-0 truncate text-xs font-normal text-gray-400">{{ hint }}</span>
      <UIcon name="i-lucide-chevron-down" class="ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div class="space-y-2 pt-2">
      <slot />
    </div>
  </details>
</template>

<script setup lang="ts">
// One collapsible group in an editor tab. A dot on the heading means the group
// holds settings that differ from the defaults, so they aren't missed while
// it is folded away.
defineProps<{ title: string; changed?: boolean; hint?: string }>()
const open = defineModel<boolean>('open', { default: true })

function onToggle(event: Event) {
  open.value = (event.target as HTMLDetailsElement).open
}
</script>
