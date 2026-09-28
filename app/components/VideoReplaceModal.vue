<template>
  <UModal v-model:open="open" title="Replace video file" :ui="{ content: 'sm:max-w-lg', body: 'space-y-4' }">
    <template #body>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The current file is kept as a version"
        description="You can restore it later from the Versions tab if this replacement turns out to be wrong."
      />

      <label
        v-if="!file"
        class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors border-gray-300 dark:border-gray-700 hover:border-primary-400"
      >
        <UIcon name="i-lucide-cloud-upload" class="w-10 h-10 text-gray-400" />
        <span class="font-medium text-gray-900 dark:text-white">Drag &amp; drop a video here, or click to choose</span>
        <span class="text-xs text-gray-500">MP4, WebM, MOV, M4V, OGV or MKV · up to {{ maxUploadMb.toLocaleString() }} MB</span>
        <input type="file" class="sr-only" :accept="accept" aria-label="Choose a video file" @change="onFilePicked" />
      </label>
      <div v-else class="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-file-video" class="w-8 h-8 text-gray-400 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-gray-900 dark:text-white truncate">{{ file.name }}</p>
            <p class="text-xs text-gray-500">
              {{ formatFileSize(file.size) }}
              <template v-if="uploadedKey"> · <span class="text-success-700 dark:text-success-400">Uploaded</span></template>
              <template v-else-if="uploading"> · Uploading {{ Math.round(uploadProgress * 100) }}%</template>
            </p>
          </div>
          <UButton v-if="uploading" size="sm" color="neutral" variant="soft" icon="i-lucide-square" @click="cancelUpload">Cancel</UButton>
          <UButton v-else size="sm" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove file" @click="clearFile" />
        </div>
        <UProgress
          v-if="uploading || uploadedKey"
          :model-value="Math.round(uploadProgress * 100)"
          size="sm"
          class="mt-3"
          :color="uploadedKey ? 'success' : 'primary'"
        />
        <div v-if="uploadError" class="mt-3 flex items-center justify-between gap-2">
          <p class="text-sm text-error-600 dark:text-error-400">{{ uploadError }}</p>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-rotate-cw" @click="startUpload(file!)">Retry</UButton>
        </div>
      </div>
      <p v-if="probeError" class="text-xs text-warning-700 dark:text-warning-400">{{ probeError }} — you can still replace it.</p>

      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
        <UButton icon="i-lucide-replace" :loading="replacing" :disabled="!uploadedKey" @click="onReplace">Replace video</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Uploads a new file and swaps it in for the video's current one — the old
// file becomes a version (VideoVersionService), never just discarded. Mirrors
// the upload half of pages/videos/new.vue.
import type { Video } from '~/composables/useVideos'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ video: Video }>()
const emit = defineEmits<{ replaced: [video: Video] }>()

const { requestUpload, replace } = useVideos()
const { probeFile } = useMediaProbe()
const { settings: clientSettings } = useClientSettings()
const toast = useToast()

const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
const accept = ['video/*', ...VIDEO_FILE_EXTENSIONS.map((e) => `.${e}`)].join(',')

const file = ref<File | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const uploadedKey = ref('')
const probeError = ref('')
const probed = reactive<{ durationSeconds?: number; width?: number; height?: number }>({})
let abort: AbortController | null = null

watch(open, (isOpen) => {
  if (!isOpen) clearFile()
})

function onFilePicked(event: Event) {
  const picked = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  if (picked) useFile(picked)
}

async function useFile(picked: File) {
  if (!isVideoFile(picked)) {
    toast.add({ title: 'That isn’t a video file', description: `Choose one of: ${VIDEO_FILE_EXTENSIONS.join(', ')}`, color: 'error' })
    return
  }
  if (picked.size > maxUploadMb.value * 1024 * 1024) {
    toast.add({ title: 'That file is too large', description: `Videos can be at most ${maxUploadMb.value.toLocaleString()} MB.`, color: 'error' })
    return
  }
  clearFile()
  file.value = picked
  const upload = startUpload(picked)
  const probe = await probeFile(picked)
  if (file.value !== picked) return
  probeError.value = probe.error ?? ''
  probed.durationSeconds = probe.durationSeconds ?? undefined
  probed.width = probe.width ?? undefined
  probed.height = probe.height ?? undefined
  await upload
}

async function startUpload(picked: File) {
  uploading.value = true
  uploadError.value = ''
  uploadProgress.value = 0
  uploadedKey.value = ''
  abort = new AbortController()
  try {
    const ticket = await requestUpload('VIDEO', picked)
    await uploadToStorage(ticket, picked, (f) => (uploadProgress.value = f), abort.signal)
    if (file.value === picked) {
      uploadedKey.value = ticket.key
      uploadProgress.value = 1
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    uploadError.value = err instanceof Error && !(err as { data?: unknown }).data ? err.message : apiErrorMessage(err)
  } finally {
    uploading.value = false
  }
}

function cancelUpload() {
  abort?.abort()
  clearFile()
}

function clearFile() {
  abort?.abort()
  abort = null
  file.value = null
  uploading.value = false
  uploadedKey.value = ''
  uploadError.value = ''
  uploadProgress.value = 0
  probeError.value = ''
}

const replacing = ref(false)
async function onReplace() {
  if (!uploadedKey.value) return
  replacing.value = true
  try {
    const video = await replace(props.video.id, {
      storageKey: uploadedKey.value,
      durationSeconds: probed.durationSeconds,
      width: probed.width,
      height: probed.height
    })
    toast.add({ title: 'Video file replaced', description: 'The previous file was kept as a version.', color: 'success' })
    open.value = false
    emit('replaced', video)
  } catch (err) {
    toast.add({ title: 'Could not replace the file', description: apiErrorMessage(err), color: 'error' })
  } finally {
    replacing.value = false
  }
}
</script>
