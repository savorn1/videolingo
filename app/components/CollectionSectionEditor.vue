<template>
  <UPopover v-model:open="open">
    <UButton size="xs" color="neutral" variant="soft" :icon="section ? 'i-lucide-tag' : 'i-lucide-plus'">
      {{ section || 'Section' }}
    </UButton>
    <template #content>
      <div class="p-3 space-y-2 w-56">
        <UFormField label="Section label" description="Shown as a heading above this video.">
          <UInput v-model="draft" placeholder="e.g. Week 1" size="sm" class="w-full" autofocus @keyup.enter="save" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton v-if="section" size="xs" color="neutral" variant="ghost" @click="clear">Clear</UButton>
          <UButton size="xs" color="primary" @click="save">Save</UButton>
        </div>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// One video row's section label, in a small popover so it doesn't crowd the
// row. Emits the new label (or null to clear) — the page owns the save call.
const props = defineProps<{ section: string | null }>()
const emit = defineEmits<{ save: [string | null] }>()

const open = ref(false)
const draft = ref(props.section ?? '')
watch(
  () => props.section,
  (v) => (draft.value = v ?? '')
)

function save() {
  emit('save', draft.value.trim() || null)
  open.value = false
}
function clear() {
  draft.value = ''
  emit('save', null)
  open.value = false
}
</script>
