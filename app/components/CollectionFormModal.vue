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
          <div class="flex gap-2">
            <UInput v-model="form.coverUrl" type="url" placeholder="https://…" icon="i-lucide-image" class="flex-1" aria-label="Cover image URL" />
            <UploadButton label="Upload" accept="image/*" variant="ghost" :progress="uploading.cover" @pick="(f: File) => uploadArtwork('cover', f)" />
          </div>
        </UFormField>

        <!-- The collection as a series on the public streaming site; its videos, in order, are the episodes -->
        <div class="rounded-lg border border-default p-4 space-y-4">
          <USwitch
            v-model="streaming.enabled"
            label="Show on RuengFlix"
            description="Lists this collection as a series on the public streaming site. Its released videos, in order, are the episodes."
          />
          <template v-if="streaming.enabled">
            <UAlert v-if="visibilityNote" color="warning" variant="subtle" icon="i-lucide-eye-off" :title="visibilityNote" />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Category" required>
                <USelect v-model="streaming.category" :items="SERIES_CATEGORIES" placeholder="Choose a category" aria-label="Category" class="w-full" />
              </UFormField>
              <UFormField label="Status">
                <USelect v-model="streaming.status" :items="SERIES_STATUSES" aria-label="Status" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <USwitch v-model="streaming.vip" label="VIP" description="Viewers pay after the free episodes." />
              <UFormField label="Free episodes" :hint="streaming.vip ? undefined : 'VIP only'">
                <UInputNumber v-model="streaming.freeEpisodes" :min="0" :max="STREAMING_LIMITS.maxFreeEpisodes" :disabled="!streaming.vip" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField
                label="Recap length"
                hint="seconds"
                description="For the Skip recap button: how long episodes 2+ open with a recap of the last one; 0 for none."
              >
                <UInputNumber v-model="streaming.recapSeconds" :min="0" :max="STREAMING_LIMITS.maxRecapSeconds" class="w-full" />
              </UFormField>
              <UFormField label="Year" hint="optional">
                <UInputNumber
                  v-model="streaming.releaseYear"
                  :format-options="{ useGrouping: false }"
                  :min="STREAMING_LIMITS.minYear"
                  :max="STREAMING_LIMITS.maxYear"
                  placeholder="2026"
                  class="w-full"
                />
              </UFormField>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Genres" hint="comma separated, up to 5">
                <UInput v-model="streaming.genres" placeholder="ស្នេហា, ទីក្រុង" class="w-full" />
              </UFormField>
              <UFormField label="Country" hint="optional">
                <UInput v-model="streaming.region" maxlength="40" placeholder="ចិន" class="w-full" />
              </UFormField>
            </div>
            <UFormField
              label="Latin search words"
              hint="optional"
              description="English or romanised words, so viewers typing on a Latin keyboard find it (e.g. “summer love sneha”)."
            >
              <UInput v-model="streaming.searchKeywords" maxlength="200" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Banner image URL" hint="wide, for the hero">
                <UInput v-model="streaming.bannerUrl" type="url" placeholder="https://…" icon="i-lucide-image" class="w-full" aria-label="Banner image URL" />
                <UploadButton
                  class="mt-1"
                  label="Upload"
                  accept="image/*"
                  variant="ghost"
                  :progress="uploading.banner"
                  @pick="(f: File) => uploadArtwork('banner', f)"
                />
              </UFormField>
              <UFormField label="Vertical image URL" hint="9:16, for Shorts">
                <UInput
                  v-model="streaming.verticalUrl"
                  type="url"
                  placeholder="https://…"
                  icon="i-lucide-smartphone"
                  class="w-full"
                  aria-label="Vertical image URL"
                />
                <UploadButton
                  class="mt-1"
                  label="Upload"
                  accept="image/*"
                  variant="ghost"
                  :progress="uploading.vertical"
                  @pick="(f: File) => uploadArtwork('vertical', f)"
                />
              </UFormField>
            </div>
            <p class="text-sm text-muted">
              The poster is the cover image above. Uploaded images are stored with your videos and served to viewers through signed links.
            </p>
            <UFormField
              label="Hero position"
              hint="optional"
              description="Shows this series in the big slider on RuengFlix's home page (1 first). Leave blank to keep it out; RuengFlix › Overview orders every pick at once."
            >
              <UInputNumber v-model="streaming.featuredRank" :min="1" :max="STREAMING_LIMITS.maxFeaturedRank" placeholder="—" class="w-32" />
            </UFormField>
            <ULink v-if="collection?.streaming?.enabled" :to="`/ruengflix/${collection.id}`" class="text-sm text-primary inline-flex items-center gap-1">
              <UIcon name="i-lucide-tv" class="size-4" /> Checklist, viewer stats and followers for this series
            </ULink>
          </template>
        </div>

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

        <UAlert v-if="streamingErrors.length" color="error" variant="subtle" title="Fix before saving" icon="i-lucide-triangle-alert">
          <template #description>
            <ul class="list-disc ps-4">
              <li v-for="p in streamingErrors" :key="p">{{ p }}</li>
            </ul>
          </template>
        </UAlert>
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
import {
  SERIES_CATEGORIES,
  SERIES_STATUSES,
  STREAMING_LIMITS,
  streamingFormFrom,
  streamingPayloadFrom,
  streamingProblems,
  streamingVisibilityNote,
  type StreamingForm
} from '#shared/utils/streamingSeries'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ collection?: Collection | null }>()
const emit = defineEmits<{ saved: [collection: Collection] }>()

const { create, update } = useCollections()
const { list: listUsers } = useUsers()
const { list: listVideos, uploadFile } = useVideos()
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
const streaming = reactive<StreamingForm>(streamingFormFrom(null))
const visibilityNote = computed(() => streamingVisibilityNote(streaming.enabled, form.visibility))
// Shown once a save is attempted, then kept in step as the fields change
const showStreamingErrors = ref(false)
const streamingErrors = computed(() => (showStreamingErrors.value ? streamingProblems(streaming) : []))

// Artwork uploads go to storage like video thumbnails (images up to 5 MB); the field gets the file's address
const uploading = reactive<Record<'cover' | 'banner' | 'vertical', number | null>>({ cover: null, banner: null, vertical: null })
async function uploadArtwork(field: 'cover' | 'banner' | 'vertical', file: File) {
  if (!file.type.startsWith('image/')) {
    toast.add({ title: 'Choose an image file', color: 'warning' })
    return
  }
  uploading[field] = 0
  try {
    const { publicUrl } = await uploadFile('THUMBNAIL', file, { onProgress: (p) => (uploading[field] = p) })
    if (field === 'cover') form.coverUrl = publicUrl
    else if (field === 'banner') streaming.bannerUrl = publicUrl
    else streaming.verticalUrl = publicUrl
  } catch (err) {
    toast.add({ title: 'Upload failed', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading[field] = null
  }
}

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
  Object.assign(streaming, streamingFormFrom(c?.streaming))
  showStreamingErrors.value = false
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
  showStreamingErrors.value = true
  if (streamingProblems(streaming).length) return
  saving.value = true
  error.value = ''
  try {
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      coverUrl: form.coverUrl.trim() || undefined,
      visibility: form.visibility,
      ownerId: form.ownerId,
      streaming: streamingPayloadFrom(streaming)
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
