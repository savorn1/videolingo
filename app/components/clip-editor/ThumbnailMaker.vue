<template>
  <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-image" title="Make a thumbnail from a frame, with words on it" @click="openMaker">
    Thumbnail
  </UButton>
  <UModal v-model:open="open" title="Make a thumbnail" description="The frame at the playhead, with words on it, becomes the video's thumbnail.">
    <template #body>
      <div class="space-y-3" data-testid="thumbnail-maker">
        <video
          ref="videoEl"
          :src="video.videoUrl"
          crossorigin="anonymous"
          muted
          playsinline
          preload="auto"
          class="hidden"
          @seeked="draw"
          @loadeddata="seekToPlayhead"
        />
        <canvas ref="canvasEl" class="aspect-video w-full rounded-md bg-black object-contain" aria-label="Thumbnail preview" />
        <p v-if="loadError" class="text-xs text-error-600 dark:text-error-400">This video can’t be read here, so its frames can’t be used.</p>
        <UFormField label="Words on it" :hint="`${text.length}/80`">
          <UInput v-model="text" :maxlength="80" class="w-full" placeholder="Leave empty for the frame alone" />
        </UFormField>
        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <USelect v-model="position" :items="POSITIONS" size="xs" class="w-28" aria-label="Where the words go" />
          <label class="flex items-center gap-1.5"
            >Colour
            <input v-model="color" type="color" class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700" aria-label="Words colour"
          /></label>
          <USwitch v-model="band" size="xs" label="Dark band behind" />
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-crosshair" @click="seekToPlayhead">Frame at the playhead</UButton>
        </div>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="close">Cancel</UButton>
        <UButton icon="i-lucide-image-up" :loading="saving" :disabled="loadError" @click="save">Use as thumbnail</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// "Thumbnail": the frame at the playhead with a title on it, drawn in the browser and saved as the video's thumbnail
// (an upload of kind THUMBNAIL, like the video form's frame picker). The video is read cross-origin, which our storage allows.
import { thumbnailFontPx, thumbnailLines } from '#shared/utils/filmstrip'
import { uploadToStorage } from '~/composables/useVideos'

const { video, currentMs, thumbnailSaved } = useClipEditorContext()
const { requestUpload, update } = useVideos()
const toast = useToast()

const POSITIONS = [
  { label: 'Top', value: 'TOP' },
  { label: 'Middle', value: 'MIDDLE' },
  { label: 'Bottom', value: 'BOTTOM' }
]
const open = ref(false)
const saving = ref(false)
const loadError = ref(false)
const text = ref('')
const position = ref('BOTTOM')
const color = ref('#ffffff')
const band = ref(true)
const videoEl = ref<HTMLVideoElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

function openMaker() {
  text.value = text.value || video.value.title.slice(0, 80)
  loadError.value = false
  open.value = true
}
function seekToPlayhead() {
  const el = videoEl.value
  if (!el) return
  el.onerror = () => (loadError.value = true)
  el.currentTime = Math.max(0, currentMs.value / 1000)
}

/** The frame (at most 1280 px wide) and the words, as the thumbnail will be. */
function draw() {
  const el = videoEl.value
  const canvas = canvasEl.value
  if (!el || !canvas || !el.videoWidth) return
  const scale = Math.min(1, 1280 / el.videoWidth)
  canvas.width = Math.round(el.videoWidth * scale)
  canvas.height = Math.round(el.videoHeight * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
  const lines = thumbnailLines(text.value, canvas.width > canvas.height ? 22 : 14)
  if (!lines.length) return
  const px = thumbnailFontPx(canvas.height, lines.length)
  const lineH = Math.round(px * 1.15)
  const blockH = lineH * lines.length + px * 0.6
  const top = position.value === 'TOP' ? canvas.height * 0.06 : position.value === 'MIDDLE' ? (canvas.height - blockH) / 2 : canvas.height * 0.94 - blockH
  if (band.value) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, top, canvas.width, blockH)
  }
  ctx.font = `800 ${px}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color.value
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = Math.round(px / 8)
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, top + px * 0.3 + i * lineH, canvas.width * 0.92))
  ctx.shadowBlur = 0
}
watch([text, position, color, band], draw)

async function save() {
  const canvas = canvasEl.value
  if (!canvas) return
  saving.value = true
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t make the picture'))), 'image/jpeg', 0.88)
      } catch {
        reject(new Error('The site hosting this video doesn’t allow its frames to be used.'))
      }
    })
    const ticket = await requestUpload('THUMBNAIL', { name: 'thumbnail.jpg', type: 'image/jpeg', size: blob.size })
    await uploadToStorage(ticket, blob)
    // The update replaces these, so they go back as they are.
    const v = video.value
    await update(v.id, { title: v.title, description: v.description ?? undefined, language: v.language ?? undefined, thumbnailUrl: ticket.publicUrl })
    open.value = false
    toast.add({ title: 'Thumbnail saved', description: 'Learners see it in the lists from now on.', color: 'success' })
    thumbnailSaved()
  } catch (err) {
    toast.add({ title: 'Could not save the thumbnail', description: err instanceof Error ? err.message : apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
