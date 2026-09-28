<template>
  <UModal v-model:open="open" title="Move video" :ui="{ content: 'sm:max-w-sm' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="New owner">
          <USelectMenu
            v-model="ownerId"
            :items="ownerOptions"
            value-key="value"
            placeholder="Choose a user"
            :search-input="{ placeholder: 'Search users…' }"
            :loading="loading"
            class="w-full"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton icon="i-lucide-move" :loading="moving" :disabled="ownerId === video.ownerId" @click="onMove">Move</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Reassigns a video to another user.
import type { Video } from '~/composables/useVideos'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ video: Video }>()
const emit = defineEmits<{ moved: [video: Video] }>()

const { moveOwner } = useVideos()
const { list: listUsers } = useUsers()
const toast = useToast()

const ownerId = ref<number | undefined>(undefined)
const owners = ref<{ id: number; username: string }[]>([])
const loading = ref(false)
const ownerOptions = computed(() => owners.value.map((u) => ({ label: u.username, value: u.id })))

watch(open, async (isOpen) => {
  if (!isOpen) return
  ownerId.value = props.video.ownerId ?? undefined
  loading.value = true
  try {
    owners.value = (await listUsers({ size: 500, sortBy: 'username', sortOrder: 'asc' })).data
  } catch {
    owners.value = []
  } finally {
    loading.value = false
  }
})

const moving = ref(false)
async function onMove() {
  moving.value = true
  try {
    const video = await moveOwner(props.video.id, ownerId.value ?? null)
    toast.add({ title: 'Video moved', color: 'success' })
    open.value = false
    emit('moved', video)
  } catch (err) {
    toast.add({ title: 'Could not move the video', description: apiErrorMessage(err), color: 'error' })
  } finally {
    moving.value = false
  }
}
</script>
