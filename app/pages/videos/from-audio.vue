<template>
  <div @dragenter.prevent="dragging = true" @dragover.prevent @dragleave.self="dragging = false" @drop.prevent="onDrop">
    <PageHeader
      title="Video from audio"
      description="Turn podcasts, songs or lesson recordings into videos: the sound over a picture, a title card or a plain colour, with an optional moving waveform."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Video from audio' }]"
    />

    <!-- Whole-page drop target -->
    <div
      v-if="dragging"
      class="fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-primary-400 bg-primary-500/10 pointer-events-none"
      aria-hidden="true"
    >
      <p class="rounded-lg bg-white px-4 py-2 font-medium text-primary-700 shadow dark:bg-gray-900 dark:text-primary-300">Drop audio files to add them</p>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" @submit.prevent="onSubmit">
      <div class="lg:col-span-3 space-y-4">
        <!-- 1. The sound -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-gray-900 dark:text-white">1. The audio</h2>
              <span v-if="items.length > 1" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {{ items.length }} files, {{ items.length }} videos
              </span>
            </div>
          </template>

          <ul v-if="items.length" class="mb-3 divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
            <li v-for="it in items" :key="it.id" class="space-y-2 px-3 py-2.5">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-file-audio" class="h-5 w-5 shrink-0 text-primary-500" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="it.name">{{ it.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {{ formatFileSize(it.size) }}<template v-if="it.durationSeconds"> · {{ formatDuration(it.durationSeconds) }}</template>
                    <template v-if="it.status === 'queued'"> · waiting</template>
                    <template v-else-if="it.status === 'uploading'"> · uploading {{ Math.round(it.progress * 100) }}%</template>
                  </p>
                </div>
                <UBadge v-if="it.status === 'ready'" color="success" variant="subtle" size="sm" icon="i-lucide-check">Uploaded</UBadge>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Remove ${it.name}`" :disabled="saving" @click="removeItem(it.id)" />
              </div>
              <UProgress v-if="it.status === 'uploading'" :model-value="Math.round(it.progress * 100)" size="xs" />
              <p v-if="it.status === 'error'" class="text-sm text-error-600 dark:text-error-400" role="alert">
                {{ it.error }}
                <UButton size="xs" color="neutral" variant="link" :padded="false" @click="retryItem(it.id)">Try again</UButton>
              </p>
              <UInput
                v-if="it.status !== 'error'"
                v-model="it.title"
                size="sm"
                maxlength="200"
                class="w-full"
                :aria-label="`Title for ${it.name}`"
                placeholder="Title"
              />
              <audio v-if="items.length === 1 && it.status === 'ready'" :src="it.previewUrl" controls preload="metadata" class="h-10 w-full" />
            </li>
          </ul>

          <label
            class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus-within:border-primary-500 dark:border-gray-700 dark:hover:bg-primary-950/20"
          >
            <UIcon name="i-lucide-upload" class="h-6 w-6 text-gray-400" />
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ items.length ? 'Add more audio files' : 'Choose audio files' }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              or drop them anywhere on this page · MP3, M4A, AAC, WAV, OGG, Opus or FLAC · up to {{ maxUploadMb }} MB each · up to {{ MAX_BATCH }} files
            </span>
            <input
              type="file"
              multiple
              class="sr-only"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.weba"
              aria-label="Choose audio files"
              @change="onPickFiles"
            />
          </label>
          <p v-if="errors.audio" class="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.audio }}</p>
        </UCard>

        <!-- 2. The look -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">2. The look</h2>
          </template>
          <div class="space-y-5">
            <!-- Picture -->
            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Cover picture <span class="font-normal text-gray-500">(optional, shared by all)</span></p>
              <div v-if="cover" class="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <img :src="cover.previewUrl" alt="" class="h-10 w-10 shrink-0 rounded object-cover" />
                <p class="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-white" :title="cover.name">{{ cover.name }}</p>
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the cover picture" :disabled="saving" @click="clearCover" />
              </div>
              <UploadButton
                v-else
                label="Add a cover picture"
                icon="i-lucide-image-plus"
                accept="image/png,image/jpeg,image/webp"
                :progress="coverUploading ? coverProgress : null"
                @pick="onPickCover"
              />
              <p v-if="errors.cover" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.cover }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Fitted inside the frame, not stretched. The first video's thumbnail is this picture.</p>
            </div>

            <!-- Title card -->
            <USwitch
              v-model="titleCard"
              :disabled="!!cover"
              label="Write the title on the picture"
              :description="cover ? 'Not used with a cover picture.' : 'Each video shows its own title, centred on the background.'"
            />

            <!-- Background -->
            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Background colour</p>
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-for="c in BACKGROUND_SWATCHES"
                  :key="c"
                  type="button"
                  class="h-7 w-7 rounded-full border border-gray-300 focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-gray-600"
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

            <!-- Waveform -->
            <div class="space-y-2">
              <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Moving waveform</p>
              <div class="flex flex-wrap gap-2" role="group" aria-label="Waveform style">
                <UButton
                  v-for="w in WAVEFORM_STYLES"
                  :key="w.value"
                  size="sm"
                  :color="waveform === w.value ? 'primary' : 'neutral'"
                  :variant="waveform === w.value ? 'soft' : 'ghost'"
                  :aria-pressed="waveform === w.value"
                  :title="w.hint"
                  @click="waveform = w.value"
                >
                  {{ w.label }}
                </UButton>
              </div>
              <div v-if="waveform !== 'NONE'" class="flex flex-wrap items-center gap-3">
                <USwitch v-model="waveAuto" label="Colour to suit the background" />
                <input
                  v-if="!waveAuto"
                  v-model="waveColor"
                  type="color"
                  aria-label="Waveform colour"
                  class="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
                />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ waveform === 'NONE' ? 'A still picture makes the smallest file.' : 'Drawn along the bottom. The file is somewhat larger than a still picture.' }}
              </p>
            </div>

            <!-- Size -->
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
            </div>
          </div>
        </UCard>

        <!-- 3. The sound -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">3. Sound clean-up</h2>
          </template>
          <div class="space-y-3">
            <USwitch v-model="normalize" label="Even out the loudness" description="Brings quiet and loud recordings to the same level." />
            <USwitch v-model="denoise" label="Reduce background noise" description="Softens steady hiss and hum. Voices can sound slightly processed." />
          </div>
        </UCard>

        <!-- 4. The details -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">4. Details</h2>
          </template>
          <div class="space-y-5">
            <UFormField label="Description" description="Shared by all the videos.">
              <UTextarea v-model="description" :rows="3" autoresize :maxrows="10" maxlength="10000" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <UFormField label="Spoken language" :error="errors.language">
                <USelectMenu
                  v-model="language"
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
                  v-model="categoryIds"
                  :items="categoryItems"
                  value-key="value"
                  multiple
                  placeholder="Choose categories"
                  aria-label="Categories"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Add to a collection" description="Keeps a series together, in the order you add it.">
                <USelectMenu
                  v-model="collectionId"
                  :items="collectionItems"
                  value-key="value"
                  placeholder="None"
                  :loading="collectionsLoading"
                  aria-label="Collection"
                  class="w-full"
                />
              </UFormField>
            </div>
            <USwitch
              v-model="transcribe"
              :disabled="!language"
              label="Transcribe when ready"
              :description="language ? 'Makes a transcript of each video once it is finished.' : 'Choose the spoken language first.'"
            />
          </div>
        </UCard>

        <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />

        <div class="flex flex-wrap items-center justify-end gap-2">
          <p class="mr-auto text-xs text-gray-500 dark:text-gray-400">Videos are created hidden. Review each one, then enable it for learners.</p>
          <UButton color="neutral" variant="ghost" to="/videos" :disabled="saving">Cancel</UButton>
          <UButton type="submit" icon="i-lucide-clapperboard" :loading="saving" :disabled="!canSubmit">{{ submitLabel }}</UButton>
        </div>
      </div>

      <!-- Preview: how the frame will look -->
      <aside class="lg:col-span-2 lg:sticky lg:top-4 space-y-2" aria-label="Preview">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</p>
        <div class="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800" :style="{ backgroundColor: background }">
          <img v-if="cover" :src="cover.previewUrl" alt="Cover picture" class="absolute inset-0 h-full w-full object-contain" />
          <p
            v-else-if="titleCard"
            class="absolute inset-x-[10%] top-1/2 -translate-y-1/2 text-center text-lg font-bold leading-tight sm:text-xl"
            :style="{ color: textColor }"
          >
            {{ previewTitle }}
          </p>
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <UIcon name="i-lucide-audio-lines" class="h-12 w-12" :class="darkBackground ? 'text-white/40' : 'text-black/30'" />
          </div>
          <!-- A still drawing of the waveform, so the placement can be judged -->
          <svg v-if="waveform !== 'NONE'" class="absolute inset-x-0 bottom-[5%] h-1/4 w-full" viewBox="0 0 100 25" preserveAspectRatio="none" aria-hidden="true">
            <template v-if="waveform === 'BARS'">
              <rect v-for="(h, i) in BAR_HEIGHTS" :key="i" :x="i * 4 + 1" :y="25 - h" width="2.6" :height="h" :fill="waveDrawColor" />
            </template>
            <polyline v-else :points="WAVE_POINTS" fill="none" :stroke="waveDrawColor" stroke-width="0.8" vector-effect="non-scaling-stroke" />
          </svg>
        </div>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <dt>Size</dt>
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ selectedSize }}</dd>
          <dt>Length</dt>
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ totalLength }}</dd>
          <dt>Videos</dt>
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ readyItems.length }}</dd>
          <dt title="Not counting uploads or waiting behind other jobs">Render time</dt>
          <dd class="text-right text-gray-700 dark:text-gray-300">{{ renderNote }}</dd>
        </dl>
      </aside>
    </form>
  </div>
</template>

<script setup lang="ts">
// Makes videos from sounds. Each audio file (and the optional cover) is uploaded
// straight to storage first; then the server makes each video in a background
// job, and this page hands over to the video (one file) or the list (several).
import {
  audioFileProblem,
  BACKGROUND_SWATCHES,
  batchProblem,
  coverFileProblem,
  DEFAULT_BACKGROUND,
  DEFAULT_RESOLUTION,
  MAX_BATCH,
  nextToUpload,
  normalizeHexColor,
  uniqueTitles,
  VIDEO_RESOLUTIONS,
  WAVEFORM_STYLES,
  type VideoResolution,
  type WaveformStyle
} from '#shared/utils/audioVideo'
import { uploadToStorage } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

interface Item {
  id: number
  file: File | null
  name: string
  size: number
  status: 'queued' | 'uploading' | 'ready' | 'error'
  progress: number
  key: string
  error: string
  previewUrl: string
  durationSeconds: number | null
  title: string
}
interface Picked {
  key: string
  name: string
  previewUrl: string
}

const videos = useVideos()
const collections = useCollections()
const toast = useToast()
const { settings: clientSettings } = useClientSettings()
const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

const items = ref<Item[]>([])
const cover = ref<Picked | null>(null)
const coverUploading = ref(false)
const coverProgress = ref(0)
const background = ref<string>(DEFAULT_BACKGROUND)
const backgroundText = ref<string>(DEFAULT_BACKGROUND)
const resolution = ref<VideoResolution>(DEFAULT_RESOLUTION)
const waveform = ref<WaveformStyle>('NONE')
const waveAuto = ref(true)
const waveColor = ref('#ffffff')
const titleCard = ref(false)
const normalize = ref(false)
const denoise = ref(false)
const description = ref('')
const language = ref<string | undefined>(undefined)
const categoryIds = ref<number[]>([])
const collectionId = ref<number | undefined>(undefined)
const transcribe = ref(false)

const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)
const submitted = ref(false)
const dragging = ref(false)

const languageItems = computed(() => [{ label: 'Not set', value: undefined }, ...languageOptions(language.value)])
const categoryItems = computed(() => categoryOptions(categoryIds.value).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))
const collectionItems = ref<{ label: string; value: number | undefined }[]>([{ label: 'None', value: undefined }])
const collectionsLoading = ref(false)
onMounted(async () => {
  collectionsLoading.value = true
  try {
    const res = await collections.list({ size: 100 })
    collectionItems.value = [{ label: 'None', value: undefined }, ...res.data.map((c) => ({ label: c.title, value: c.id }))]
  } catch {
    // The picker just stays on "None".
  } finally {
    collectionsLoading.value = false
  }
})

// A transcript needs to know the language; drop the choice if it goes away.
watch(language, (l) => {
  if (!l) transcribe.value = false
})
// The title goes on the picture only when there is no cover to show.
watch(cover, (c) => {
  if (c) titleCard.value = false
})

const readyItems = computed(() => items.value.filter((i) => i.status === 'ready'))
const uploadingAny = computed(() => coverUploading.value || items.value.some((i) => i.status === 'queued' || i.status === 'uploading'))
const canSubmit = computed(() => readyItems.value.length > 0 && !uploadingAny.value && !saving.value && readyItems.value.every((i) => i.title.trim()))
const submitLabel = computed(() => {
  if (uploadingAny.value) return 'Waiting for the uploads…'
  const n = readyItems.value.length
  return n > 1 ? `Make ${n} videos` : 'Make the video'
})

const selectedSize = computed(() => VIDEO_RESOLUTIONS.find((r) => r.value === resolution.value)?.size ?? '')
const totalLength = computed(() => {
  const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
  return total ? formatDuration(total) : '—'
})
// Measured on a laptop: 10 minutes of audio rendered in about 15 s (still) to 27 s (waveform at 1080p).
// These rates allow about twice that for a slower server. Only the render is counted: the uploads and
// any wait behind other jobs (the worker does one job at a time) come on top.
const renderNote = computed(() => {
  const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
  if (!total) return '—'
  const perSecond = waveform.value === 'NONE' ? 0.05 : 0.08
  const seconds = Math.round(total * perSecond)
  return seconds < 60 ? 'under a minute' : `about ${Math.round(seconds / 60)} min`
})

// Colours for the preview
const darkBackground = computed(() => {
  const n = parseInt(background.value.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.55
})
const textColor = computed(() => (darkBackground.value ? '#ffffff' : '#111111'))
const waveDrawColor = computed(() => (waveAuto.value ? textColor.value : waveColor.value))
const previewTitle = computed(() => readyItems.value[0]?.title.trim() || items.value[0]?.title.trim() || 'Your title here')
const BAR_HEIGHTS = [6, 12, 9, 18, 14, 22, 10, 16, 20, 8, 15, 21, 11, 17, 9, 13, 19, 7, 12, 10, 14, 6, 9, 5]
const WAVE_POINTS = Array.from({ length: 51 }, (_, i) => `${i * 2},${12.5 - Math.sin(i * 0.9) * (3 + 8 * Math.abs(Math.sin(i * 0.17)))}`).join(' ')

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

// ── The audio files ──────────────────────────────────────────────────────────
let nextId = 1
function addFiles(files: File[]) {
  errors.value.audio = ''
  const problem = batchProblem(items.value.length + files.length)
  if (problem) {
    errors.value.audio = problem
    return
  }
  const rejected: string[] = []
  for (const file of files) {
    const fileProblem = audioFileProblem(file, maxUploadMb.value)
    if (fileProblem) {
      rejected.push(`${file.name}: ${fileProblem}`)
      continue
    }
    items.value.push({
      id: nextId++,
      file,
      name: file.name,
      size: file.size,
      status: 'queued',
      progress: 0,
      key: '',
      error: '',
      previewUrl: URL.createObjectURL(file),
      durationSeconds: null,
      title: titleFromFileName(file.name)
    })
  }
  if (rejected.length) errors.value.audio = rejected.join(' · ')
  pump()
}
function onPickFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) addFiles(files)
}
function onDrop(event: DragEvent) {
  dragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) addFiles(files)
}

/** Uploads one file at a time so a big batch doesn't compete with itself. */
async function pump() {
  const i = nextToUpload(items.value.map((x) => x.status))
  if (i === null) return
  const item = items.value[i]!
  if (!item.file) return
  item.status = 'uploading'
  item.progress = 0
  try {
    const [seconds, ticket] = await Promise.all([readDuration(item.file), videos.requestUpload('AUDIO', item.file)])
    item.durationSeconds = seconds
    await uploadToStorage(ticket, item.file, (f) => (item.progress = f))
    item.key = ticket.key
    item.status = 'ready'
    item.file = null
  } catch (err) {
    item.status = 'error'
    item.error = `Could not upload: ${apiErrorMessage(err)}`
  }
  pump()
}
function retryItem(id: number) {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.status = 'queued'
  item.error = ''
  pump()
}
function removeItem(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i === -1) return
  URL.revokeObjectURL(items.value[i]!.previewUrl)
  items.value.splice(i, 1)
}

// ── The cover ────────────────────────────────────────────────────────────────
async function onPickCover(file: File) {
  errors.value.cover = ''
  const problem = coverFileProblem(file)
  if (problem) {
    errors.value.cover = problem
    return
  }
  coverUploading.value = true
  coverProgress.value = 0
  try {
    const ticket = await videos.requestUpload('OVERLAY', file)
    await uploadToStorage(ticket, file, (f) => (coverProgress.value = f))
    cover.value = { key: ticket.key, name: file.name, previewUrl: URL.createObjectURL(file) }
  } catch (err) {
    errors.value.cover = `Could not upload the picture: ${apiErrorMessage(err)}`
  } finally {
    coverUploading.value = false
  }
}
function clearCover() {
  if (cover.value) URL.revokeObjectURL(cover.value.previewUrl)
  cover.value = null
}
onBeforeUnmount(() => {
  items.value.forEach((i) => URL.revokeObjectURL(i.previewUrl))
  clearCover()
})

// ── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  errors.value = {}
  saveError.value = ''
  if (!readyItems.value.length) {
    errors.value.audio = 'Choose the audio first'
    return
  }
  if (requireCategory.value && !categoryIds.value.length) errors.value.categoryIds = 'Choose at least one category'
  if (categoryIds.value.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
  if (transcribe.value && !language.value) errors.value.language = 'Choose the spoken language to transcribe'
  if (Object.keys(errors.value).length) return

  saving.value = true
  const chosen = readyItems.value
  const titles = uniqueTitles(chosen.map((i) => i.title.trim()))
  const made: { id: number; jobId: number; title: string }[] = []
  const failed: string[] = []
  try {
    // One at a time and in order, so a collection ends up in the order the files were added.
    for (let i = 0; i < chosen.length; i++) {
      try {
        const result = await videos.createFromAudio({
          audioKey: chosen[i]!.key,
          coverKey: cover.value?.key,
          background: background.value,
          resolution: resolution.value,
          waveform: waveform.value,
          waveColor: waveform.value !== 'NONE' && !waveAuto.value ? waveColor.value : undefined,
          titleCard: titleCard.value && !cover.value ? true : undefined,
          normalize: normalize.value || undefined,
          denoise: denoise.value || undefined,
          transcribe: transcribe.value || undefined,
          title: titles[i]!,
          description: description.value.trim() || undefined,
          language: language.value,
          categoryIds: categoryIds.value
        })
        made.push({ id: result.video.id, jobId: result.job.id, title: titles[i]! })
      } catch (err) {
        failed.push(`${titles[i]}: ${apiErrorMessage(err)}`)
        if (chosen.length === 1) throw err
      }
    }

    if (collectionId.value && made.length) {
      try {
        await collections.addVideos(collectionId.value, made.map((m) => m.id))
      } catch (err) {
        toast.add({ title: 'Made the videos, but could not add them to the collection', description: apiErrorMessage(err), color: 'warning' })
      }
    }
  } catch (err) {
    saveError.value = apiErrorMessage(err)
    saving.value = false
    return
  }
  saving.value = false

  if (!made.length) {
    saveError.value = failed.join(' · ')
    return
  }
  submitted.value = true
  if (failed.length) {
    toast.add({ title: `${made.length} of ${chosen.length} videos are being made`, description: failed.join(' · '), color: 'warning' })
  } else {
    toast.add({
      title: made.length === 1 ? 'Making the video' : `Making ${made.length} videos`,
      description: 'You can leave; it keeps going in the background.',
      color: 'success'
    })
  }
  // One video: go to it (it shows the progress). Several: the list, where they show up hidden.
  await navigateTo(made.length === 1 ? `/videos/${made[0]!.id}` : '/videos')
}

useUnsavedChangesGuard(() => !submitted.value && (items.value.length > 0 || coverUploading.value))
</script>
