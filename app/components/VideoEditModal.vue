<template>
  <UModal v-model:open="open" :title="`Edit '${video?.title ?? ''}'`" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div v-if="canPickFrame" class="mb-4 space-y-2">
        <div class="flex items-center gap-3">
          <img
            v-if="form.thumbnailUrl"
            :src="form.thumbnailUrl"
            alt="Current thumbnail"
            class="w-32 aspect-video rounded object-cover bg-gray-100 dark:bg-gray-800"
          />
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-film" @click="showFramePicker = !showFramePicker">
            {{ showFramePicker ? 'Hide frame picker' : 'Choose a thumbnail frame…' }}
          </UButton>
        </div>
        <ThumbnailPicker v-if="showFramePicker" :src="video!.videoUrl" @picked="onFramePicked" />
      </div>
      <DynamicForm
        v-model="form"
        :fields="fields"
        :loading="saving"
        :error="error"
        submit-label="Save changes"
        cancelable
        @submit="onSubmit"
        @cancel="open = false"
      />
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { FieldDef } from '#shared/types'
import type { Video } from '~/composables/useVideos'
import { VIDEO_VISIBILITIES } from '~/composables/useVideos'

const { settings: clientSettings } = useClientSettings()

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ video: Video | null }>()
const emit = defineEmits<{ saved: [video: Video] }>()

const { update } = useVideos()
const toast = useToast()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const form = ref<Record<string, any>>({})
const saving = ref(false)
const error = ref('')

// Only the descriptive fields are editable — duration, resolution, size and
// format describe the uploaded file itself (see UpdateVideoRequest).
const fields = computed<FieldDef[]>(() => [
  { name: 'title', required: true, maxLength: 200, wrapper: 'full' },
  { name: 'description', type: 'textarea', rows: 4, wrapper: 'full' },
  {
    name: 'language',
    label: 'Spoken language',
    type: 'combobox',
    options: [{ label: 'Not set', value: undefined }, ...languageOptions(props.video?.language)]
  },
  { name: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url', placeholder: 'https://…' },
  {
    name: 'visibility',
    type: 'select',
    options: VIDEO_VISIBILITIES.map((v) => ({ label: `${v.label} — ${v.description}`, value: v.value }))
  },
  {
    name: 'categoryIds',
    label: 'Categories',
    type: 'multiselect',
    options: categoryOptions(props.video?.categories.map((c) => c.id) ?? []),
    placeholder: categoryCatalog().length ? 'Choose categories' : 'No categories yet — add some under Categories',
    // Settings › Video (enforced on save).
    required: clientSettings.value?.requireCategory ?? false,
    hint: `Up to ${clientSettings.value?.maxCategoriesPerVideo ?? 10}`,
    wrapper: 'full'
  }
])

// Only files we can load in the browser — platform embeds (YouTube, …) can't be captured.
const canPickFrame = computed(() => !!props.video?.videoUrl && !props.video.embedUrl)
const showFramePicker = ref(false)

function onFramePicked(url: string) {
  form.value = { ...form.value, thumbnailUrl: url }
  showFramePicker.value = false
  toast.add({ title: 'Frame captured — save to keep it', color: 'info' })
}

// Refill from the target each time the modal opens, so a previous video's
// unsaved edits never carry over.
watch(open, (value) => {
  if (!value || !props.video) return
  form.value = {
    title: props.video.title,
    description: props.video.description ?? '',
    language: props.video.language ?? undefined,
    thumbnailUrl: props.video.thumbnailUrl ?? '',
    visibility: props.video.visibility,
    categoryIds: props.video.categories.map((c) => c.id)
  }
  error.value = ''
  showFramePicker.value = false
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubmit(values: Record<string, any>) {
  if (!props.video) return
  saving.value = true
  error.value = ''
  try {
    const saved = await update(props.video.id, {
      title: values.title?.trim(),
      description: values.description || undefined,
      language: values.language || undefined,
      thumbnailUrl: values.thumbnailUrl || undefined,
      visibility: values.visibility || undefined,
      categoryIds: values.categoryIds ?? []
    })
    toast.add({ title: 'Video updated', color: 'success' })
    open.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
