<template>
  <div
    class="flex items-center gap-2 rounded-md transition-colors"
    :class="dragging ? 'ring-2 ring-primary-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900' : ''"
    @dragenter.prevent="dragging = true"
    @dragover.prevent
    @dragleave.self="dragging = false"
    @drop.prevent="onDrop"
  >
    <UButton size="xs" color="neutral" variant="soft" :icon="icon ?? 'i-lucide-upload'" :loading="progress != null" @click="input?.click()">
      {{ progress != null ? `Uploading ${Math.round(progress * 100)}%` : label }}
    </UButton>
    <UProgress v-if="progress != null" :model-value="Math.round(progress * 100)" size="xs" class="flex-1" />
    <span v-else-if="dragging" class="text-xs text-primary-600 dark:text-primary-400">Drop to upload</span>
    <input ref="input" type="file" class="hidden" :accept="accept ?? 'audio/*'" @change="onChange" />
  </div>
</template>

<script setup lang="ts">
// A button that opens the file picker, or takes a dropped file — the parent
// does the uploading and passes its progress (0–1) back, or null when idle.
defineProps<{ label: string; icon?: string; accept?: string; progress: number | null }>()
const emit = defineEmits<{ pick: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const dragging = ref(false)

function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (file) emit('pick', file)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) emit('pick', file)
}
</script>
