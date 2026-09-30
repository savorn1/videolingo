<template>
  <div>
    <PageHeader
      title="Video from audio"
      description="Turn a podcast, song or lesson recording into a video: the sound over a cover picture or a plain colour."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Video from audio' }]"
    />

    <form class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" @submit.prevent="onSubmit">
      <div class="lg:col-span-3 space-y-4">
        <!-- 1. The sound -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">1. The audio</h2>
          </template>

          <div v-if="audio" class="space-y-3">
            <div class="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
              <UIcon name="i-lucide-file-audio" class="w-5 h-5 text-primary-500 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="audio.name">{{ audio.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {{ formatFileSize(audio.size) }}<template v-if="audio.durationSeconds"> · {{ formatDuration(audio.durationSeconds) }}</template>
                </p>
              </div>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the audio file" :disabled="saving" @click="clearAudio" />
            </div>
            <audio :src="audio.previewUrl" controls preload="metadata" class="w-full h-10" />
          </div>
          <div v-else class="space-y-2">
            <UploadButton
              label="Choose an audio file"
              icon="i-lucide-upload"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.weba"
              :progress="uploading === 'audio' ? uploadProgress : null"
              @pick="onPickAudio"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400">MP3, M4A, AAC, WAV, OGG, Opus or FLAC, up to {{ maxUploadMb }} MB. You can also drop a file here.</p>
          </div>
          <p v-if="errors.audio" class="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.audio }}</p>
        </UCard>

        <!-- 2. The picture -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">2. The picture <span class="text-sm font-normal text-gray-500">(optional)</span></h2>
          </template>
          <div class="space-y-4">
            <div v-if="cover" class="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
              <img :src="cover.previewUrl" alt="" class="h-10 w-10 rounded object-cover shrink-0" />
              <p class="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white" :title="cover.name">{{ cover.name }}</p>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the cover picture" :disabled="saving" @click="clearCover" />
            </div>
            <UploadButton
              v-else
              label="Add a cover picture"
              icon="i-lucide-image-plus"
              accept="image/png,image/jpeg,image/webp"
              :progress="uploading === 'cover' ? uploadProgress : null"
              @pick="onPickCover"
            />
            <p v-if="errors.cover" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.cover }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              The picture is fitted inside the frame, not stretched. It also becomes the video's thumbnail. Without one, the frame is just the background colour.
            </p>

            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Background colour</p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-for="c in BACKGROUND_SWATCHES"
                  :key="c"
                  type="button"
                  class="h-7 w-7 rounded-full border border-gray-300 dark:border-gray-600 focus-visible:outline-2 focus-visible:outline-primary-500"
                  :class="background === c ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''"
                  :style="{ backgroundColor: c }"
                  :aria-label="`Background ${c}`"
                  :aria-pressed="background === c"
                  @click="setBackground(c)"
                />
                <input
                  :value="background"
                  type="color"
                  aria-label="Pick a background colour"
                  class="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
                  @input="(e) => setBackground((e.target as HTMLInputElement).value)"
                />
                <UInput
                  :model-value="backgroundText"
                  size="sm"
                  class="w-24 font-mono"
                  maxlength="7"
                  aria-label="Background colour (hex)"
                  @update:model-value="(v) => (backgroundText = String(v))"
                  @change="commitBackgroundText"
                />
              </div>
            </div>

            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Video size</p>
              <div class="flex flex-wrap gap-2" role="group" aria-label="Video size">
                <UButton
                  v-for="r in VIDEO_RESOLUTIONS"
                  :key="r.value"
                  size="sm"
                  :color="resolution === r.value ? 'primary' : 'neutral'"
                  :variant="resolution === r.value ? 'soft' : 'ghost'"
                  :aria-pressed="resolution === r.value"
                  @click="resolution = r.value"
                >
                  {{ r.label }} <span class="text-xs opacity-70 tabular-nums">{{ r.size }}</span>
                </UButton>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">A still picture stays small in any size. Pick the one that suits the cover.</p>
            </div>
          </div>
        </UCard>

        <!-- 3. The details -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">3. Details</h2>
          </template>
          <div class="space-y-5">
            <UFormField label="Title" required :error="errors.title">
              <UInput v-model="form.title" maxlength="200" class="w-full" aria-label="Title" />
            </UFormField>
            <UFormField label="Description">
              <UTextarea v-model="form.description" :rows="3" autoresize :maxrows="10" maxlength="10000" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <UFormField label="Spoken language">
                <USelectMenu
                  v-model="form.language"
                  :items="languageItems"
                  value-key="value"
                  placeholder="Not set"
                  :search-input="{ placeholder: 'Search languages…' }"
                  aria-label="Spoken language"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Categories" :required="requireCategory" :error="errors.categoryIds" :hint="`Up to ${maxCategories}`">
                <USelectMenu
                  v-model="form.categoryIds"
                  :items="categoryItems"
                  value-key="value"
                  multiple
                  placeholder="Choose categories"
                  aria-label="Categories"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />

        <div class="flex flex-wrap items-center justify-end gap-2">
          <p class="mr-auto text-xs text-gray-500 dark:text-gray-400">The video is created hidden. Review it, then enable it for learners.</p>
          <UButton color="neutral" variant="ghost" to="/videos" :disabled="saving">Cancel</UButton>
          <UButton type="submit" icon="i-lucide-clapperboard" :loading="saving" :disabled="!canSubmit">
            {{ uploading ? 'Waiting for the upload…' : 'Make the video' }}
          </UButton>
        </div>
      </div>

      <!-- Preview: how the frame will look -->
      <aside class="lg:col-span-2 lg:sticky lg:top-4 space-y-2" aria-label="Preview">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</p>
        <div class="relative w-full aspect-video overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800" :style="{ backgroundColor: background }">
          <img v-if="cover" :src="cover.previewUrl" alt="Cover picture" class="absolute inset-0 h-full w-full object-contain" />
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <UIcon name="i-lucide-audio-lines" class="h-12 w-12" :class="darkBackground ? 'text-white/40' : 'text-black/30'" />
          </div>
        </div>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <dt>Size</dt>
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ selectedSize }}</dd>
          <dt>Length</dt>
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ audio?.durationSeconds ? formatDuration(audio.durationSeconds) : '—' }}</dd>
        </dl>
      </aside>
    </form>
  </div>
</template>

<script setup lang="ts">
// Makes a video from a sound. The audio (and optional cover) are uploaded straight
// to storage first; then the server makes the video in a background job, and this
// page hands over to that job's progress page.
import {
  audioFileProblem,
  BACKGROUND_SWATCHES,
  coverFileProblem,
  DEFAULT_BACKGROUND,
  DEFAULT_RESOLUTION,
  normalizeHexColor,
  VIDEO_RESOLUTIONS,
  type VideoResolution
} from '#shared/utils/audioVideo'
import { uploadToStorage } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

interface Picked {
  key: string
  name: string
  size: number
  previewUrl: string
  durationSeconds?: number | null
}

const videos = useVideos()
const toast = useToast()
const { settings: clientSettings } = useClientSettings()
const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

const audio = ref<Picked | null>(null)
const cover = ref<Picked | null>(null)
const background = ref<string>(DEFAULT_BACKGROUND)
const backgroundText = ref<string>(DEFAULT_BACKGROUND)
const resolution = ref<VideoResolution>(DEFAULT_RESOLUTION)
const form = reactive({ title: '', description: '', language: undefined as string | undefined, categoryIds: [] as number[] })
const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)
const submitted = ref(false)
const uploading = ref<'audio' | 'cover' | null>(null)
const uploadProgress = ref(0)

const languageItems = computed(() => [{ label: 'Not set', value: undefined }, ...languageOptions(form.language)])
const categoryItems = computed(() => categoryOptions(form.categoryIds).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))
const selectedSize = computed(() => VIDEO_RESOLUTIONS.find((r) => r.value === resolution.value)?.size ?? '')
const canSubmit = computed(() => !!audio.value && !!form.title.trim() && !uploading.value && !saving.value)

// Whether the placeholder icon should be light or dark on the chosen colour.
const darkBackground = computed(() => {
  const n = parseInt(background.value.slice(1), 16)
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return luminance < 0.55
})

function setBackground(value: string) {
  const hex = normalizeHexColor(value)
  if (!hex) return
  background.value = hex
  backgroundText.value = hex
}
function commitBackgroundText() {
  const hex = normalizeHexColor(backgroundText.value)
  if (hex) setBackground(hex)
  else backgroundText.value = background.value // put the last good colour back
}

/** The sound's length, read in the browser so it can be shown before anything is made. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new Audio()
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : null)
    el.onerror = () => done(null)
    el.src = url
  })
}

async function upload(file: File, kind: 'AUDIO' | 'OVERLAY'): Promise<string> {
  const ticket = await videos.requestUpload(kind, file)
  await uploadToStorage(ticket, file, (f) => (uploadProgress.value = f))
  return ticket.key
}

async function onPickAudio(file: File) {
  errors.value.audio = ''
  const problem = audioFileProblem(file, maxUploadMb.value)
  if (problem) {
    errors.value.audio = problem
    return
  }
  uploading.value = 'audio'
  uploadProgress.value = 0
  try {
    const [seconds, key] = await Promise.all([readDuration(file), upload(file, 'AUDIO')])
    audio.value = { key, name: file.name, size: file.size, previewUrl: URL.createObjectURL(file), durationSeconds: seconds }
    if (!form.title.trim()) form.title = titleFromFileName(file.name)
  } catch (err) {
    errors.value.audio = `Could not upload the audio: ${apiErrorMessage(err)}`
  } finally {
    uploading.value = null
  }
}

async function onPickCover(file: File) {
  errors.value.cover = ''
  const problem = coverFileProblem(file)
  if (problem) {
    errors.value.cover = problem
    return
  }
  uploading.value = 'cover'
  uploadProgress.value = 0
  try {
    const key = await upload(file, 'OVERLAY')
    cover.value = { key, name: file.name, size: file.size, previewUrl: URL.createObjectURL(file) }
  } catch (err) {
    errors.value.cover = `Could not upload the picture: ${apiErrorMessage(err)}`
  } finally {
    uploading.value = null
  }
}

function clearAudio() {
  if (audio.value) URL.revokeObjectURL(audio.value.previewUrl)
  audio.value = null
}
function clearCover() {
  if (cover.value) URL.revokeObjectURL(cover.value.previewUrl)
  cover.value = null
}
onBeforeUnmount(() => {
  clearAudio()
  clearCover()
})

async function onSubmit() {
  errors.value = {}
  saveError.value = ''
  if (!audio.value) {
    errors.value.audio = 'Choose the audio first'
    return
  }
  if (!form.title.trim()) errors.value.title = 'Give the video a title'
  if (requireCategory.value && !form.categoryIds.length) errors.value.categoryIds = 'Choose at least one category'
  if (form.categoryIds.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
  if (Object.keys(errors.value).length) return

  saving.value = true
  try {
    const result = await videos.createFromAudio({
      audioKey: audio.value.key,
      coverKey: cover.value?.key,
      background: background.value,
      resolution: resolution.value,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      language: form.language,
      categoryIds: form.categoryIds
    })
    submitted.value = true
    toast.add({ title: 'Making the video', description: 'You can leave this page; it keeps going in the background.', color: 'success' })
    await navigateTo(`/processing-jobs/${result.job.id}`)
  } catch (err) {
    saveError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

useUnsavedChangesGuard(() => !submitted.value && (!!audio.value || !!uploading.value))
</script>
