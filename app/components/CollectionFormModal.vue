<template>
  <UModal v-model:open="open" :title="collection ? `Edit “${collection.title}”` : 'New collection'" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Title" required>
          <UInput v-model="form.title" maxlength="200" placeholder="e.g. Café Japanese — Week 1" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Description" hint="optional">
          <UTextarea v-model="form.description" :rows="3" maxlength="2000" class="w-full" placeholder="What will learners get from this collection?" />
        </UFormField>

        <UFormField label="Visibility" required>
          <URadioGroup
            v-model="form.visibility"
            :items="COLLECTION_VISIBILITIES.map((v) => ({ label: v.label, description: v.description, value: v.value }))"
            orientation="horizontal"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Owner" :hint="collection ? undefined : 'defaults to you'">
            <USelectMenu
              v-model="form.ownerId"
              :items="ownerOptions"
              value-key="value"
              placeholder="Choose a user"
              :search-input="{ placeholder: 'Search users…' }"
              aria-label="Owner"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Slug" :hint="collection ? 'Changing it breaks old links' : 'optional'">
            <UInput v-model="form.slug" :placeholder="collection?.slug ?? 'generated from the title'" icon="i-lucide-link" class="w-full font-mono" />
          </UFormField>
        </div>

        <UFormField label="Cover image URL" hint="optional">
          <UInput v-model="form.coverUrl" type="url" placeholder="https://…" icon="i-lucide-image" class="w-full" />
        </UFormField>

        <UFormField v-if="!collection" label="Videos" hint="optional — you can add more later" description="Kept in the order you pick them.">
          <USelectMenu
            v-model="form.videoIds"
            :items="videoOptions"
            value-key="value"
            multiple
            placeholder="Choose videos"
            :search-input="{ placeholder: 'Search videos…' }"
            aria-label="Videos"
            class="w-full"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton type="submit" :loading="saving" :disabled="!form.title.trim()">{{ collection ? 'Save changes' : 'Create' }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { COLLECTION_VISIBILITIES, type Collection, type CollectionVisibility } from '~/composables/useCollections'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ collection?: Collection | null }>()
const emit = defineEmits<{ saved: [collection: Collection] }>()

const { create, update } = useCollections()
const { list: listUsers } = useUsers()
const { list: listVideos } = useVideos()
const toast = useToast()

const form = reactive<{
  title: string
  slug: string
  description: string
  coverUrl: string
  visibility: CollectionVisibility
  ownerId: number | undefined
  videoIds: number[]
}>({ title: '', slug: '', description: '', coverUrl: '', visibility: 'PRIVATE', ownerId: undefined, videoIds: [] })
const saving = ref(false)
const error = ref('')

const users = ref<{ id: number; username: string }[]>([])
const videos = ref<{ id: number; title: string }[]>([])
const ownerOptions = computed(() => users.value.map((u) => ({ label: u.username, value: u.id })))
const videoOptions = computed(() => videos.value.map((v) => ({ label: v.title, value: v.id })))

watch(open, async (value) => {
  if (!value) return
  error.value = ''
  const c = props.collection
  Object.assign(form, {
    title: c?.title ?? '',
    slug: '',
    description: c?.description ?? '',
    coverUrl: c?.coverUrl ?? '',
    visibility: c?.visibility ?? 'PRIVATE',
    ownerId: c?.ownerId ?? undefined,
    videoIds: []
  })
  try {
    const [u, v] = await Promise.all([
      users.value.length ? null : listUsers({ size: 500, sortBy: 'username', sortOrder: 'asc' }),
      c || videos.value.length ? null : listVideos({ size: 500, sortBy: 'title', sortOrder: 'asc' })
    ])
    if (u) users.value = u.data
    if (v) videos.value = v.data
  } catch {
    // pickers just stay empty
  }
})

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      coverUrl: form.coverUrl.trim() || undefined,
      visibility: form.visibility,
      ownerId: form.ownerId
    }
    const saved = props.collection
      ? await update(props.collection.id, payload)
      : await create({ ...payload, videoIds: form.videoIds.length ? form.videoIds : undefined })
    toast.add({ title: props.collection ? 'Collection updated' : `“${saved.title}” created`, color: 'success' })
    open.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
