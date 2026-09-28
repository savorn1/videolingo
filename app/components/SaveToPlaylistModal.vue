<template>
  <UModal v-model:open="open" title="Save to a playlist" :ui="{ content: 'sm:max-w-sm' }">
    <template #body>
      <div class="space-y-3">
        <div v-if="loading" class="space-y-2">
          <USkeleton v-for="i in 3" :key="i" class="h-9" />
        </div>
        <div v-else-if="playlists.length" class="space-y-1 max-h-64 overflow-y-auto">
          <button
            v-for="p in playlists"
            :key="p.id"
            type="button"
            class="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            :disabled="saving === p.id"
            @click="addTo(p)"
          >
            <span class="truncate">{{ p.title }}</span>
            <UIcon v-if="added.has(p.id)" name="i-lucide-check" class="w-4 h-4 text-success-500 shrink-0" />
            <UIcon v-else-if="saving === p.id" name="i-lucide-loader-2" class="w-4 h-4 animate-spin shrink-0" />
            <span v-else class="text-xs text-gray-400 shrink-0">{{ p.videoCount }} video{{ p.videoCount === 1 ? '' : 's' }}</span>
          </button>
        </div>
        <EmptyState v-else icon="i-lucide-list-plus" title="No playlists yet" description="Make one below." class="py-4" />
        <USeparator />
        <form class="flex gap-2" @submit.prevent="createAndAdd">
          <UInput v-model="newTitle" placeholder="New playlist name" size="sm" class="flex-1" />
          <UButton type="submit" size="sm" icon="i-lucide-plus" :loading="creating" :disabled="!newTitle.trim()">Create</UButton>
        </form>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Add the current video to one of the learner's own playlists, or create a
// new one on the spot. Playlists are always-private collections (usePlaylists).
import type { Collection } from '~/composables/useCollections'

const props = defineProps<{ videoId: number }>()
const open = defineModel<boolean>('open', { required: true })

const { mine, create, addVideo } = usePlaylists()
const toast = useToast()

const playlists = ref<Collection[]>([])
const loading = ref(false)
const saving = ref<number | null>(null)
const added = reactive(new Set<number>())
const newTitle = ref('')
const creating = ref(false)

async function load() {
  loading.value = true
  try {
    playlists.value = (await mine(1, 100)).data
  } catch {
    playlists.value = []
  } finally {
    loading.value = false
  }
}
watch(open, (v) => {
  if (v) {
    added.clear()
    newTitle.value = ''
    load()
  }
})

async function addTo(p: Collection) {
  saving.value = p.id
  try {
    await addVideo(p.id, props.videoId)
    added.add(p.id)
    toast.add({ title: `Added to “${p.title}”`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not add to playlist', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = null
  }
}

async function createAndAdd() {
  const title = newTitle.value.trim()
  if (!title) return
  creating.value = true
  try {
    const p = await create(title)
    playlists.value.unshift(p)
    newTitle.value = ''
    await addTo(p)
  } catch (err) {
    toast.add({ title: 'Could not create playlist', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>
