<template>
  <span
    class="inline-flex items-center gap-0.5 rounded-md bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap"
  >
    <span class="text-gray-400">#</span>{{ name }}
    <button
      v-if="removable"
      type="button"
      class="ml-0.5 -mr-0.5 rounded text-gray-400 hover:text-error-500 disabled:opacity-40"
      :disabled="busy"
      :aria-label="`Remove tag ${name}`"
      @click.stop="emit('remove')"
    >
      <UIcon name="i-lucide-x" class="w-3 h-3 align-middle" />
    </button>
  </span>
</template>

<script setup lang="ts">
defineProps<{ name: string; removable?: boolean; busy?: boolean }>()
const emit = defineEmits<{ remove: [] }>()
</script>
