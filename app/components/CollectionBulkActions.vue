<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect v-model="targetVisibility" :items="visibilityOptions" size="xs" placeholder="Change visibility to…" class="w-48" />
    <UButton size="xs" color="primary" variant="soft" icon="i-lucide-eye" :disabled="!targetVisibility" @click="openAction('visibility')">Apply</UButton>
    <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" @click="openAction('duplicate')">Duplicate</UButton>
    <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" @click="openAction('delete')">Delete</UButton>

    <UModal v-model:open="show" :title="title" :description="`${collections.length} selected collection${collections.length === 1 ? '' : 's'}`">
      <template #body>
        <div class="space-y-4">
          <p v-if="action === 'delete'" class="text-sm text-gray-600 dark:text-gray-300">
            The videos in each collection are not deleted — only the collections themselves.
          </p>
          <p v-else-if="action === 'duplicate'" class="text-sm text-gray-600 dark:text-gray-300">
            Makes a full copy of each — same videos, sections and visibility.
          </p>
          <p v-else class="text-sm text-gray-600 dark:text-gray-300">
            Sets every selected collection to <span class="font-medium">{{ visibilityLabel }}</span
            >.
          </p>

          <div
            v-if="results.length"
            class="rounded-lg border border-gray-200 dark:border-gray-800 max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 text-sm"
          >
            <div v-for="(r, i) in results" :key="i" class="flex items-start gap-2 px-3 py-1.5">
              <UIcon
                :name="r.outcome === 'ok' ? 'i-lucide-check-circle' : 'i-lucide-x-circle'"
                class="w-4 h-4 mt-0.5 shrink-0"
                :class="r.outcome === 'ok' ? 'text-success-500' : 'text-error-500'"
              />
              <span class="min-w-0"
                ><span class="font-medium">{{ r.title }}</span> — {{ r.message }}</span
              >
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="show = false">{{ results.length ? 'Close' : 'Cancel' }}</UButton>
            <UButton v-if="!results.length" :color="action === 'delete' ? 'error' : 'primary'" :loading="running" @click="run">{{ title }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// Bulk actions for the selected cards on the collections grid: change
// visibility, duplicate, or delete. Each runs per collection (the API is
// per-collection) and reports every outcome, mirroring VideoBulkActions.
import { COLLECTION_VISIBILITIES, type Collection, type CollectionVisibility } from '~/composables/useCollections'

const props = defineProps<{ collections: Collection[] }>()
const emit = defineEmits<{ done: [] }>()

const { update, remove, duplicate } = useCollections()
const toast = useToast()

type Action = 'visibility' | 'duplicate' | 'delete'
const action = ref<Action>('visibility')
const show = ref(false)
const running = ref(false)
const results = ref<{ title: string; outcome: 'ok' | 'failed'; message: string }[]>([])

const visibilityOptions = COLLECTION_VISIBILITIES.map((v) => ({ label: v.label, value: v.value }))
const targetVisibility = ref<CollectionVisibility | undefined>()
const visibilityLabel = computed(() => COLLECTION_VISIBILITIES.find((v) => v.value === targetVisibility.value)?.label ?? '')

const title = computed(() => ({ visibility: 'Change visibility', duplicate: 'Duplicate collections', delete: 'Delete collections' })[action.value])

function openAction(a: Action) {
  action.value = a
  results.value = []
  show.value = true
}

async function run() {
  running.value = true
  results.value = []
  for (const c of props.collections) {
    try {
      if (action.value === 'visibility') {
        await update(c.id, {
          title: c.title,
          slug: c.slug,
          description: c.description ?? undefined,
          coverUrl: c.coverUrl ?? undefined,
          visibility: targetVisibility.value!
        })
        results.value.push({ title: c.title, outcome: 'ok', message: `set to ${visibilityLabel.value}` })
      } else if (action.value === 'duplicate') {
        const copy = await duplicate(c.id)
        results.value.push({ title: c.title, outcome: 'ok', message: `copied as “${copy.title}”` })
      } else {
        await remove(c.id)
        results.value.push({ title: c.title, outcome: 'ok', message: 'deleted' })
      }
    } catch (err) {
      results.value.push({ title: c.title, outcome: 'failed', message: apiErrorMessage(err) })
    }
  }
  const ok = results.value.filter((r) => r.outcome === 'ok').length
  const failed = results.value.filter((r) => r.outcome === 'failed').length
  toast.add({ title: `${title.value}: ${ok} done${failed ? `, ${failed} failed` : ''}`, color: failed ? 'warning' : 'success' })
  running.value = false
  emit('done')
}
</script>
