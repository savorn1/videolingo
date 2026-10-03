<template>
  <span class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap" :class="tone.chip">
    <span :class="tone.hash">#</span>{{ name }}
    <button
      v-if="removable"
      type="button"
      class="ml-0.5 -mr-0.5 rounded opacity-60 hover:text-error-600 hover:opacity-100 disabled:opacity-40"
      :disabled="busy"
      :aria-label="`Remove tag ${name}`"
      @click.stop="emit('remove')"
    >
      <UIcon name="i-lucide-x" class="w-3 h-3 align-middle" />
    </button>
  </span>
</template>

<script setup lang="ts">
import { tagTone } from '#shared/utils/tagColor'

const props = defineProps<{ name: string; removable?: boolean; busy?: boolean }>()
// Each tag has its own colour, worked out from its name (see shared/utils/tagColor.ts).
const tone = computed(() => tagTone(props.name))
const emit = defineEmits<{ remove: [] }>()
</script>
