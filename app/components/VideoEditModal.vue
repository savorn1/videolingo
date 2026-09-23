<template>
  <UModal v-model:open="open" :title="`Edit '${video?.title ?? ''}'`" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
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
    name: 'categoryIds',
    label: 'Categories',
    type: 'multiselect',
    options: categoryOptions(props.video?.categories.map((c) => c.id) ?? []),
    placeholder: categoryCatalog().length ? 'Choose categories' : 'No categories yet — add some under Categories',
    wrapper: 'full'
  }
])

// Refill from the target each time the modal opens, so a previous video's
// unsaved edits never carry over.
watch(open, (value) => {
  if (!value || !props.video) return
  form.value = {
    title: props.video.title,
    description: props.video.description ?? '',
    language: props.video.language ?? undefined,
    thumbnailUrl: props.video.thumbnailUrl ?? '',
    categoryIds: props.video.categories.map((c) => c.id)
  }
  error.value = ''
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
