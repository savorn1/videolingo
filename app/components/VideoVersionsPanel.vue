<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
    <div v-else-if="loading" class="p-4 space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-14" />
    </div>
    <EmptyState
      v-else-if="!versions.length"
      icon="i-lucide-history"
      title="No prior versions"
      description="Replacing the file, or promoting a trim/crop edit, keeps the old file here."
      class="py-10"
    />
    <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
      <li v-for="v in versions" :key="v.id" class="flex items-center gap-3 px-4 py-3">
        <UIcon name="i-lucide-file-video" class="w-5 h-5 text-gray-400 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ v.note ?? 'Prior version' }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ v.fileSize === null ? '—' : formatFileSize(v.fileSize) }}
            <template v-if="v.durationSeconds"> · {{ formatDuration(v.durationSeconds) }}</template>
            <template v-if="v.width && v.height"> · {{ v.width }}×{{ v.height }}</template>
            · {{ formatRelativeTime(v.createdAt) }}<template v-if="v.createdBy"> by {{ v.createdBy }}</template>
          </p>
        </div>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" :to="v.url" target="_blank">Preview</UButton>
        <UButton v-if="canWrite" size="xs" color="primary" :loading="restoring === v.id" @click="confirmRestore = v">Restore</UButton>
        <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Discard version" @click="onDiscard(v)" />
      </li>
    </ul>

    <ConfirmModal
      :model-value="confirmRestore !== null"
      title="Restore this version"
      description="This becomes the video's current file again. The current file is kept as a new version, so nothing is lost."
      confirm-label="Restore"
      :loading="restoring !== null"
      @update:model-value="(v: boolean) => !v && restoring === null && (confirmRestore = null)"
      @confirm="confirmRestore && onRestore(confirmRestore)"
    />
  </div>
</template>

<script setup lang="ts">
import type { VideoVersion } from '~/composables/useVideoVersions'

const props = defineProps<{ videoId: number; canWrite: boolean }>()
const emit = defineEmits<{ restored: [video: import('~/composables/useVideos').Video] }>()

const { list, restore, remove } = useVideoVersions()
const toast = useToast()

const versions = ref<VideoVersion[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    versions.value = await list(props.videoId)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.videoId, load)

const confirmRestore = ref<VideoVersion | null>(null)
const restoring = ref<number | null>(null)
async function onRestore(v: VideoVersion) {
  restoring.value = v.id
  try {
    const video = await restore(props.videoId, v.id)
    toast.add({ title: 'Version restored', color: 'success' })
    confirmRestore.value = null
    emit('restored', video)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not restore this version', description: apiErrorMessage(err), color: 'error' })
  } finally {
    restoring.value = null
  }
}

async function onDiscard(v: VideoVersion) {
  try {
    await remove(props.videoId, v.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not discard this version', description: apiErrorMessage(err), color: 'error' })
  }
}

defineExpose({ load })
</script>
