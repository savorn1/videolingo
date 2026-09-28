<template>
  <div>
    <PageHeader
      title="Edit video"
      :description="video?.title"
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: video?.title ?? '…', to: `/videos/${id}` }, { label: 'Edit video' }]"
    >
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-arrow-left" :to="`/videos/${id}`">Back to video</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/videos">Back to videos</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading && !video" :fields="4" :lines="false" />

    <template v-else-if="video">
      <UAlert
        v-if="video.deleted"
        color="error"
        variant="subtle"
        icon="i-lucide-trash-2"
        title="This video is in the trash"
        description="Restore it before editing."
      />
      <UAlert
        v-else-if="isLink"
        color="warning"
        variant="subtle"
        icon="i-lucide-link"
        :title="`This video plays from ${videoSourceMeta(video.source).label}`"
        description="Only files in your storage can be edited. Import it first (Download › Import into your storage on the video page)."
      >
        <template #actions>
          <UButton size="xs" color="neutral" variant="soft" :to="`/videos/${id}`">Open the video page</UButton>
        </template>
      </UAlert>
      <VideoClipEditor v-else :video="video" :can-write="canWrite" @replaced="load" @created="onCreated" />
    </template>
  </div>
</template>

<script setup lang="ts">
// Trim, crop, resize and split a video — a page of its own (it used to be a
// modal on the video page), so the preview gets the room precise cropping needs.
import type { Video } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { get } = useVideos()
const { can } = useAuth()

const id = computed(() => Number(route.params.id))
const video = ref<Video | null>(null)
const loading = ref(false)
const error = ref('')
const canWrite = computed(() => can('videos', 'WRITE'))
const isLink = computed(() => !!video.value && ['YOUTUBE', 'VIMEO', 'FACEBOOK'].includes(video.value.source))

async function load() {
  loading.value = true
  error.value = ''
  try {
    video.value = await get(id.value)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function onCreated(newVideoId: number) {
  toast.add({ title: 'New video created', description: "It's disabled until you review it — opening it now.", color: 'success' })
  navigateTo(`/videos/${newVideoId}`)
}

watch(id, load)
onMounted(load)
</script>
