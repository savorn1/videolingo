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
      <li v-for="v in versions" :key="v.id" class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <!-- Thumbnail: the first frame of the file, click to preview in the page -->
        <button
          type="button"
          class="group relative shrink-0 w-28 aspect-video overflow-hidden rounded-md bg-black cursor-pointer focus-visible:outline-2 focus-visible:outline-primary-500"
          :aria-label="`Preview ${v.note ?? 'prior version'}`"
          @click="previewing = v"
        >
          <video :src="`${v.url}#t=0.1`" preload="metadata" muted playsinline tabindex="-1" class="w-full h-full object-cover pointer-events-none" />
          <span class="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/50 transition-colors">
            <UIcon name="i-lucide-play" class="w-6 h-6 text-white" />
          </span>
          <span v-if="v.durationSeconds" class="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] tabular-nums text-white">
            {{ formatDuration(v.durationSeconds) }}
          </span>
        </button>
        <div class="min-w-0 flex-1 basis-48">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ v.note ?? 'Prior version' }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ v.fileSize === null ? '—' : formatFileSize(v.fileSize) }}
            <template v-if="v.width && v.height"> · {{ v.width }}×{{ v.height }}</template>
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatRelativeTime(v.createdAt) }}<template v-if="v.createdBy"> by {{ v.createdBy }}</template></p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" @click="previewing = v">Preview</UButton>
          <UButton v-if="currentUrl" size="xs" color="neutral" variant="soft" icon="i-lucide-columns-2" @click="comparing = v">Compare</UButton>
          <UButton v-if="canWrite" size="xs" color="primary" :loading="restoring === v.id" @click="confirmRestore = v">Restore</UButton>
          <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Discard version" @click="confirmDiscard = v" />
        </div>
      </li>
    </ul>

    <VersionPreviewModal
      :version="previewing"
      :can-write="canWrite"
      :can-compare="!!currentUrl"
      @close="previewing = null"
      @compare="(v) => ((previewing = null), (comparing = v))"
      @restore="(v) => ((previewing = null), (confirmRestore = v))"
    />
    <VersionCompareModal :version="comparing" :current-url="currentUrl ?? ''" :current-label="currentLabel" @close="comparing = null" />

    <ConfirmModal
      :model-value="confirmDiscard !== null"
      title="Discard this version"
      :description="`Delete “${confirmDiscard?.note ?? 'this prior version'}” and its file? It can't be restored afterwards. The video's current file is not affected.`"
      confirm-label="Discard"
      color="error"
      @update:model-value="(v: boolean) => !v && (confirmDiscard = null)"
      @confirm="onConfirmDiscard"
    />

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

const props = defineProps<{ videoId: number; canWrite: boolean; currentUrl?: string | null; currentLabel?: string }>()
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

const comparing = ref<VideoVersion | null>(null)
const previewing = ref<VideoVersion | null>(null)
const currentLabel = computed(() => props.currentLabel ?? 'now')

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

const confirmDiscard = ref<VideoVersion | null>(null)
async function onConfirmDiscard() {
  const v = confirmDiscard.value
  confirmDiscard.value = null
  if (v) await onDiscard(v)
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
