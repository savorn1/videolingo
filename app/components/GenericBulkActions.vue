<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton v-if="setEnabled" size="xs" color="neutral" variant="soft" icon="i-lucide-check" :loading="busy === 'enable'" :disabled="!!busy" @click="run('enable')">
      Enable selected
    </UButton>
    <UButton v-if="setEnabled" size="xs" color="neutral" variant="soft" icon="i-lucide-ban" :loading="busy === 'disable'" :disabled="!!busy" @click="run('disable')">
      Disable selected
    </UButton>
    <UButton v-if="remove" size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="!!busy" @click="confirming = true">Delete selected</UButton>

    <ConfirmModal
      :model-value="confirming"
      :title="`Delete ${items.length} ${entityLabel}${items.length === 1 ? '' : 's'}`"
      description="This can't be undone."
      confirm-label="Delete"
      color="error"
      :loading="busy === 'delete'"
      @update:model-value="(v: boolean) => !v && !busy && (confirming = false)"
      @confirm="run('delete')"
    />
  </div>
</template>

<script setup lang="ts" generic="T extends { id: number }">
// A generic "N selected" action bar for DataTable's bulk-actions slot: loops
// the entity's own single-item remove/setEnabled over the selection (there's
// no bulk endpoint to call instead), reporting partial failures rather than
// stopping at the first one. Pass only the actions that make sense for the
// entity — e.g. tags have no enabled/disabled state, so `setEnabled` is left out.
const props = defineProps<{
  items: T[]
  /** Singular, lowercase — "tag", "category", "glossary". */
  entityLabel: string
  label: (item: T) => string
  remove?: (id: number) => Promise<unknown>
  setEnabled?: (id: number, enabled: boolean) => Promise<unknown>
}>()
const emit = defineEmits<{ done: [] }>()

const toast = useToast()
const confirming = ref(false)
const busy = ref<'enable' | 'disable' | 'delete' | null>(null)

async function run(action: 'enable' | 'disable' | 'delete') {
  busy.value = action
  const failures: string[] = []
  for (const item of props.items) {
    try {
      if (action === 'delete') await props.remove?.(item.id)
      else await props.setEnabled?.(item.id, action === 'enable')
    } catch (err) {
      failures.push(`${props.label(item)}: ${apiErrorMessage(err)}`)
    }
  }
  busy.value = null
  confirming.value = false
  const ok = props.items.length - failures.length
  const verb = action === 'delete' ? 'deleted' : action === 'enable' ? 'enabled' : 'disabled'
  if (ok) toast.add({ title: `${ok} ${props.entityLabel}${ok === 1 ? '' : 's'} ${verb}`, color: 'success' })
  if (failures.length) {
    toast.add({
      title: `${failures.length} couldn't be ${verb}`,
      description: failures.slice(0, 3).join('; ') + (failures.length > 3 ? '…' : ''),
      color: 'error'
    })
  }
  emit('done')
}
</script>
