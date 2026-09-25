<template>
  <div @dragenter.prevent="onDragEnter" @dragover.prevent @dragleave="onDragLeave" @drop.prevent="onDrop">
    <PageHeader
      title="Add video"
      description="Paste a link from YouTube, Vimeo or Facebook, link a video file, or upload one."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Add video' }]"
    />

    <!-- Whole-page drop target -->
    <div
      v-if="dragging"
      class="fixed inset-0 z-50 bg-primary-500/10 backdrop-blur-[1px] border-4 border-dashed border-primary-400 flex items-center justify-center pointer-events-none"
    >
      <div class="rounded-xl bg-white dark:bg-gray-900 px-6 py-4 shadow-lg text-center">
        <UIcon name="i-lucide-download" class="w-8 h-8 text-primary-500 mx-auto mb-1" />
        <p class="font-semibold text-gray-900 dark:text-white">Drop a video file or a link</p>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-[1fr_26rem] gap-4 items-start">
      <div class="space-y-4 min-w-0">
        <!-- 1. Source -->
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="font-semibold text-gray-900 dark:text-white">1. Where's the video?</h2>
              <UTabs v-model="mode" :items="modeItems" :content="false" size="sm" class="w-full sm:w-80" />
            </div>
          </template>

          <div v-if="mode === 'link'" class="space-y-3">
            <UFormField :error="linkError ?? undefined" :help="linkError ? undefined : 'You can also paste (Ctrl/⌘+V) or drop a link anywhere on this page.'">
              <UInput
                ref="urlField"
                v-model="urlInput"
                size="xl"
                icon="i-lucide-link"
                placeholder="https://www.youtube.com/watch?v=…"
                class="w-full"
                aria-label="Video link"
                autofocus
                :loading="inspecting"
                @keydown.enter.prevent="inspectNow"
                @paste="onFieldPaste"
              >
                <template v-if="urlInput" #trailing>
                  <UButton color="neutral" variant="link" size="sm" icon="i-lucide-x" aria-label="Clear link" @click="clearLink" />
                </template>
              </UInput>
            </UFormField>
            <ul class="flex flex-wrap gap-2" aria-label="Supported sources">
              <li
                v-for="s in linkSources"
                :key="s.value"
                class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                :class="
                  inspected?.source === s.value
                    ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                "
                :title="s.hint"
              >
                <UIcon :name="s.icon" class="w-3.5 h-3.5" />
                {{ s.label }}
              </li>
            </ul>
            <UAlert v-if="inspectError" color="error" variant="subtle" icon="i-lucide-link-2-off" :title="inspectError" />
          </div>

          <div v-else class="space-y-3">
            <label
              v-if="!file"
              class="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
              :class="dragging ? 'border-primary-400 bg-primary-50/50 dark:bg-primary-950/20' : 'border-gray-300 dark:border-gray-700 hover:border-primary-400'"
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
            <p v-if="probeError" class="text-xs text-warning-700 dark:text-warning-400">
              {{ probeError }} — you can still upload it and fill in the details yourself.
            </p>
          </div>
        </UCard>

        <!-- 2. Details -->
        <UCard v-if="hasSource">
          <template #header>
            <h2 class="font-semibold text-gray-900 dark:text-white">2. Details</h2>
          </template>
          <form class="space-y-5" novalidate @submit.prevent="onSave">
            <UFormField label="Title" required :error="errors.title" :hint="`${form.title.length}/200`">
              <UInput v-model="form.title" maxlength="200" class="w-full" />
            </UFormField>
            <UFormField label="Description" :error="errors.description">
              <UTextarea v-model="form.description" :rows="4" autoresize :maxrows="12" maxlength="10000" class="w-full" />
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <UFormField label="Spoken language" :error="errors.language">
                <div class="flex gap-2">
                  <USelectMenu
                    v-model="form.language"
                    :items="languageItems"
                    value-key="value"
                    placeholder="Not set"
                    :search-input="{ placeholder: 'Search languages…' }"
                    aria-label="Spoken language"
                    class="flex-1"
                  />
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-scan-text"
                    :loading="detecting"
                    :disabled="!form.title.trim()"
                    title="Detect from title and description"
                    @click="detectFromText"
                  >
                    Detect
                  </UButton>
                </div>
                <template #help>
                  <span v-if="languageNote" :class="languageNote.warn ? 'text-warning-700 dark:text-warning-400' : ''">{{ languageNote.text }}</span>
                </template>
              </UFormField>
              <UFormField label="Length" :error="errors.durationSeconds" help="m:ss or h:mm:ss — filled in automatically when it can be read">
                <UInput v-model="form.duration" placeholder="e.g. 3:34" class="w-40" icon="i-lucide-clock" aria-label="Length" />
              </UFormField>
            </div>

            <UFormField label="Thumbnail" :error="errors.thumbnailUrl">
              <div class="flex flex-wrap items-start gap-4">
                <div class="w-48 aspect-video rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    v-if="form.thumbnailUrl"
                    :src="form.thumbnailUrl"
                    alt="Thumbnail preview"
                    class="w-full h-full object-cover"
                    @error="thumbBroken = true"
                    @load="thumbBroken = false"
                  />
                  <UIcon v-else name="i-lucide-image" class="w-8 h-8 text-gray-400" />
                </div>
                <div class="flex-1 min-w-56 space-y-2">
                  <UInput v-model="form.thumbnailUrl" placeholder="https://… (image address)" class="w-full" icon="i-lucide-link" aria-label="Thumbnail URL" />
                  <p v-if="thumbBroken && form.thumbnailUrl" class="text-xs text-warning-700 dark:text-warning-400">That image couldn't be loaded.</p>
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      v-if="canCaptureFrame"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-camera"
                      :loading="thumbUploading"
                      @click="captureFromPreview"
                    >
                      Use the current frame
                    </UButton>
                    <UButton
                      v-if="suggestedThumbnail && form.thumbnailUrl !== suggestedThumbnail"
                      size="xs"
                      color="neutral"
                      variant="soft"
                      icon="i-lucide-undo-2"
                      @click="form.thumbnailUrl = suggestedThumbnail"
                    >
                      Use {{ inspected ? videoSourceMeta(inspected.source).label : 'the detected' }} thumbnail
                    </UButton>
                  </div>
                </div>
              </div>
            </UFormField>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
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
              <USwitch v-model="form.enabled" label="Visible to learners" description="Off keeps it hidden until you enable it." class="sm:mt-6" />
            </div>

            <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />

            <div class="flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <UButton color="neutral" variant="ghost" to="/videos">Cancel</UButton>
              <UButton type="submit" icon="i-lucide-plus" :loading="saving" :disabled="!canSave">
                {{ uploading ? 'Waiting for the upload…' : 'Add video' }}
              </UButton>
            </div>
          </form>
        </UCard>
      </div>

      <!-- Preview -->
      <UCard class="xl:sticky xl:top-4" :ui="{ body: 'space-y-3' }">
        <template #header>
          <h2 class="font-semibold text-gray-900 dark:text-white">Preview</h2>
        </template>
        <VideoPlayer
          v-if="preview"
          ref="player"
          :embed-url="preview.embedUrl"
          :video-url="preview.videoUrl"
          :poster="form.thumbnailUrl || null"
          :vertical="preview.vertical"
          read-duration
          @duration="onPlayerDuration"
        />
        <div v-else class="aspect-video rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-2 text-gray-400">
          <UIcon
            :name="inspecting || probing ? 'i-lucide-loader-circle' : 'i-lucide-film'"
            class="w-8 h-8"
            :class="inspecting || probing ? 'animate-spin' : ''"
          />
          <span class="text-sm">{{ inspecting ? 'Checking the link…' : probing ? 'Reading the file…' : 'Nothing to preview yet' }}</span>
        </div>

        <dl v-if="facts.length" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <template v-for="f in facts" :key="f.label">
            <dt class="text-gray-500">{{ f.label }}</dt>
            <dd class="text-gray-900 dark:text-white min-w-0 truncate" :title="f.value">
              <span class="inline-flex items-center gap-1.5"><UIcon v-if="f.icon" :name="f.icon" class="w-4 h-4" />{{ f.value }}</span>
            </dd>
          </template>
        </dl>

        <UAlert
          v-for="w in inspected?.warnings ?? []"
          :key="w"
          color="warning"
          variant="subtle"
          icon="i-lucide-info"
          :description="w"
          :ui="{ description: 'text-xs' }"
        />

        <UAlert v-if="inspected?.duplicates.length" color="warning" variant="subtle" icon="i-lucide-copy" title="Already added">
          <template #description>
            <ul class="text-xs space-y-0.5">
              <li v-for="d in inspected.duplicates" :key="d.id">
                <NuxtLink :to="`/videos/${d.id}`" class="underline">{{ d.title }}</NuxtLink>
                (#{{ d.id }}<template v-if="d.trashed">, in the trash</template>)
              </li>
            </ul>
            <UCheckbox v-model="form.allowDuplicate" label="Add it again anyway" class="mt-2" />
          </template>
        </UAlert>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { InspectedLink, LanguageGuess } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const videos = useVideos()
const { probeFile, probeUrl } = useMediaProbe()
const toast = useToast()
const { settings: clientSettings } = useClientSettings()

type Mode = 'link' | 'upload'
const mode = ref<Mode>('link')
const modeItems: TabsItem[] = [
  { label: 'Paste a link', value: 'link', icon: 'i-lucide-link' },
  { label: 'Upload a file', value: 'upload', icon: 'i-lucide-upload' }
]
const linkSources = VIDEO_SOURCES.filter((s) => s.value !== 'UPLOAD')
const accept = ['video/*', ...VIDEO_FILE_EXTENSIONS.map((e) => `.${e}`)].join(',')
const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

// ── the form ────────────────────────────────────────────────────────────
const form = reactive({
  title: '',
  description: '',
  language: undefined as string | undefined,
  duration: '',
  width: null as number | null,
  height: null as number | null,
  thumbnailUrl: '',
  sourceAuthor: '',
  mimeType: '',
  categoryIds: [] as number[],
  enabled: true,
  allowDuplicate: false
})
const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)
const languageGuess = ref<LanguageGuess | null>(null)
const detecting = ref(false)
const suggestedThumbnail = ref('')
const thumbBroken = ref(false)
const thumbUploading = ref(false)

const languageItems = computed(() => [{ label: 'Not set', value: undefined }, ...languageOptions(form.language)])
const categoryItems = computed(() => categoryOptions(form.categoryIds).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))

function resetForm() {
  Object.assign(form, {
    title: '',
    description: '',
    language: undefined,
    duration: '',
    width: null,
    height: null,
    thumbnailUrl: '',
    sourceAuthor: '',
    mimeType: '',
    allowDuplicate: false
  })
  languageGuess.value = null
  suggestedThumbnail.value = ''
  errors.value = {}
  saveError.value = ''
}

function applyLanguage(guess: LanguageGuess | null) {
  languageGuess.value = guess
  if (guess?.inCatalog && guess.enabled) form.language = guess.code
}

const languageNote = computed(() => {
  const g = languageGuess.value
  if (!g) return null
  const how = g.source === 'platform' ? 'from the platform’s captions' : `from the title and description (${Math.round(g.confidence * 100)}% sure)`
  if (!g.inCatalog) return { warn: true, text: `Looks like “${g.code}” ${how}, but that language isn’t in your catalog.` }
  if (!g.enabled) return { warn: true, text: `Looks like ${g.name} ${how}, but it’s disabled under Languages.` }
  return { warn: false, text: `Detected ${g.name} ${how}.` }
})

async function detectFromText() {
  detecting.value = true
  try {
    const guess = await videos.detectLanguage(form.title, form.description)
    if (!guess) toast.add({ title: 'Couldn’t tell the language', description: 'Add a longer title or description, or pick it yourself.', color: 'neutral' })
    applyLanguage(guess)
  } catch (err) {
    toast.add({ title: 'Couldn’t detect the language', description: apiErrorMessage(err), color: 'error' })
  } finally {
    detecting.value = false
  }
}

// ── link source ─────────────────────────────────────────────────────────
const urlInput = ref('')
const inspecting = ref(false)
const inspected = ref<InspectedLink | null>(null)
const inspectError = ref('')
const linkError = computed(() => linkProblem(urlInput.value))
let inspectTimer: ReturnType<typeof setTimeout> | undefined
let inspectSeq = 0

watch(urlInput, (value) => {
  clearTimeout(inspectTimer)
  inspectError.value = ''
  if (!value.trim()) {
    inspected.value = null
    return
  }
  if (inspected.value && value.trim() === inspected.value.url) return
  inspectTimer = setTimeout(inspectNow, 700)
})

async function inspectNow() {
  clearTimeout(inspectTimer)
  const url = urlInput.value.trim()
  if (!url || linkProblem(url)) return
  const seq = ++inspectSeq
  inspecting.value = true
  inspectError.value = ''
  try {
    const result = await videos.inspect(url)
    if (seq !== inspectSeq) return
    inspected.value = result
    resetForm()
    form.title = result.title ?? ''
    form.description = result.description ?? ''
    form.duration = result.durationSeconds ? formatDuration(result.durationSeconds) : ''
    form.width = result.width
    form.height = result.height
    form.thumbnailUrl = result.thumbnailUrl ?? ''
    suggestedThumbnail.value = result.thumbnailUrl ?? ''
    form.sourceAuthor = result.author ?? ''
    form.mimeType = result.mimeType ?? ''
    applyLanguage(result.language)
    // A file on another site: the browser reads its length (and a frame, if the site allows).
    if (result.kind === 'FILE') await probeLinkedFile(result.url, seq)
  } catch (err) {
    if (seq !== inspectSeq) return
    inspected.value = null
    inspectError.value = apiErrorMessage(err)
  } finally {
    if (seq === inspectSeq) inspecting.value = false
  }
}

async function probeLinkedFile(url: string, seq: number) {
  const probe = await probeUrl(url)
  if (seq !== inspectSeq) return
  if (probe.durationSeconds) form.duration = formatDuration(probe.durationSeconds)
  form.width = probe.width ?? form.width
  form.height = probe.height ?? form.height
  if (probe.thumbnail) await uploadThumbnail(probe.thumbnail)
}

function clearLink() {
  urlInput.value = ''
  inspected.value = null
  inspectError.value = ''
  resetForm()
}

function onFieldPaste(event: ClipboardEvent) {
  // Pasting into the field replaces it with just the link, then checks it at once.
  const url = extractUrl(event.clipboardData?.getData('text'))
  if (url) {
    event.preventDefault()
    urlInput.value = url
    nextTick(inspectNow)
  }
}

// ── upload source ───────────────────────────────────────────────────────
const file = ref<File | null>(null)
const localUrl = ref('')
const probing = ref(false)
const probeError = ref('')
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const uploadedKey = ref('')
let abort: AbortController | null = null

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
    toast.add({
      title: 'That file is too large',
      description: `Videos can be at most ${maxUploadMb.value.toLocaleString()} MB (Settings › Video).`,
      color: 'error'
    })
    return
  }
  clearFile()
  resetForm()
  mode.value = 'upload'
  file.value = picked
  localUrl.value = URL.createObjectURL(picked)
  form.title = titleFromFileName(picked.name)
  form.mimeType = picked.type
  // Read the file and upload it at the same time.
  const upload = startUpload(picked)
  probing.value = true
  probeError.value = ''
  const probe = await probeFile(picked)
  probing.value = false
  if (file.value !== picked) return
  probeError.value = probe.error ?? ''
  if (probe.durationSeconds) form.duration = formatDuration(probe.durationSeconds)
  form.width = probe.width
  form.height = probe.height
  if (probe.thumbnail) await uploadThumbnail(probe.thumbnail)
  if (form.title) detectQuietly()
  await upload
}

async function startUpload(picked: File) {
  uploading.value = true
  uploadError.value = ''
  uploadProgress.value = 0
  uploadedKey.value = ''
  abort = new AbortController()
  try {
    const ticket = await videos.requestUpload('VIDEO', picked)
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
  if (localUrl.value) URL.revokeObjectURL(localUrl.value)
  localUrl.value = ''
  file.value = null
  uploading.value = false
  uploadedKey.value = ''
  uploadError.value = ''
  uploadProgress.value = 0
  probeError.value = ''
}

async function detectQuietly() {
  try {
    applyLanguage(await videos.detectLanguage(form.title, form.description))
  } catch {
    // optional
  }
}

// ── thumbnails ──────────────────────────────────────────────────────────
async function uploadThumbnail(blob: Blob) {
  thumbUploading.value = true
  try {
    const ticket = await videos.requestUpload('THUMBNAIL', { name: 'thumbnail.jpg', type: 'image/jpeg', size: blob.size })
    await uploadToStorage(ticket, blob)
    form.thumbnailUrl = ticket.publicUrl
    if (!suggestedThumbnail.value) suggestedThumbnail.value = ticket.publicUrl
  } catch (err) {
    toast.add({ title: 'Couldn’t save the thumbnail', description: err instanceof Error ? err.message : apiErrorMessage(err), color: 'warning' })
  } finally {
    thumbUploading.value = false
  }
}

const player = ref<{ videoEl: HTMLVideoElement | null } | null>(null)
const canCaptureFrame = computed(() => !!preview.value && !preview.value.embedUrl)

async function captureFromPreview() {
  const el = player.value?.videoEl
  if (!el) return
  try {
    await uploadThumbnail(await captureFrame(el))
  } catch {
    toast.add({
      title: 'Couldn’t capture this frame',
      description: 'The site hosting the file doesn’t allow it — paste a thumbnail address instead.',
      color: 'warning'
    })
  }
}

// ── preview ─────────────────────────────────────────────────────────────
const hasSource = computed(() => (mode.value === 'link' ? !!inspected.value : !!file.value))
const preview = computed(() => {
  if (mode.value === 'link' && inspected.value) {
    const r = inspected.value
    return {
      embedUrl: r.embedUrl,
      videoUrl: r.kind === 'FILE' ? r.url : null,
      vertical: r.kind === 'SHORT' || r.kind === 'REEL' || (!!form.width && !!form.height && form.height > form.width)
    }
  }
  if (mode.value === 'upload' && localUrl.value) {
    return { embedUrl: null, videoUrl: localUrl.value, vertical: !!form.width && !!form.height && form.height > form.width }
  }
  return null
})

function onPlayerDuration(seconds: number) {
  if (!form.duration) form.duration = formatDuration(seconds)
}

const facts = computed(() => {
  const out: { label: string; value: string; icon?: string }[] = []
  if (mode.value === 'link' && inspected.value) {
    const r = inspected.value
    const meta = videoSourceMeta(r.source)
    const kind = r.kind === 'SHORT' ? ' Short' : r.kind === 'REEL' ? ' Reel' : r.kind === 'LIVE' ? ' live stream' : r.kind === 'FILE' ? '' : ' video'
    out.push({ label: 'Source', value: `${meta.label}${kind}`, icon: meta.icon })
    if (r.author) out.push({ label: 'By', value: r.author })
    if (r.externalId) out.push({ label: 'ID', value: r.externalId })
    if (r.fileSize) out.push({ label: 'Size', value: formatFileSize(r.fileSize) })
  } else if (file.value) {
    out.push({ label: 'Source', value: 'Upload', icon: 'i-lucide-upload' })
    out.push({ label: 'Size', value: formatFileSize(file.value.size) })
    if (file.value.type) out.push({ label: 'Format', value: file.value.type })
  }
  const seconds = parseDurationInput(form.duration)
  if (seconds) out.push({ label: 'Length', value: formatDuration(seconds) })
  if (form.width && form.height) out.push({ label: 'Resolution', value: `${form.width}×${form.height}` })
  return out
})

// ── save ────────────────────────────────────────────────────────────────
const canSave = computed(
  () =>
    hasSource.value &&
    !!form.title.trim() &&
    !saving.value &&
    !uploading.value &&
    (mode.value === 'link' || !!uploadedKey.value) &&
    (!inspected.value?.duplicates.length || form.allowDuplicate || mode.value === 'upload')
)

async function onSave() {
  errors.value = {}
  saveError.value = ''
  const seconds = parseDurationInput(form.duration)
  if (form.duration.trim() && seconds === null) errors.value.durationSeconds = 'Use m:ss, h:mm:ss or a number of seconds'
  if (requireCategory.value && !form.categoryIds.length) errors.value.categoryIds = 'Choose at least one category'
  if (form.categoryIds.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const created = await videos.create({
      mode: mode.value === 'link' ? 'LINK' : 'UPLOAD',
      url: mode.value === 'link' ? inspected.value!.url : undefined,
      storageKey: mode.value === 'upload' ? uploadedKey.value : undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      language: form.language,
      durationSeconds: seconds ?? undefined,
      width: form.width ?? undefined,
      height: form.height ?? undefined,
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      sourceAuthor: form.sourceAuthor || undefined,
      mimeType: form.mimeType || undefined,
      categoryIds: form.categoryIds,
      enabled: form.enabled,
      allowDuplicate: form.allowDuplicate
    })
    saved.value = true
    toast.add({ title: 'Video added', description: created.title, color: 'success' })
    await navigateTo(`/videos/${created.id}`)
  } catch (err) {
    errors.value = (err as { data?: { errors?: Record<string, string> } })?.data?.errors ?? {}
    saveError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

// Leaving with a picked source (or mid-upload) asks first.
const saved = ref(false)
useUnsavedChangesGuard(() => !saved.value && (hasSource.value || uploading.value))

// ── paste & drop anywhere on the page ───────────────────────────────────
const dragging = ref(false)
let dragDepth = 0
function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/plain')) return
  dragDepth++
  dragging.value = true
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragging.value = false
}
function onDrop(e: DragEvent) {
  dragDepth = 0
  dragging.value = false
  const dropped = e.dataTransfer?.files?.[0]
  if (dropped) return useFile(dropped)
  const url = extractUrl(e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain'))
  if (url) takeLink(url)
}

function takeLink(url: string) {
  mode.value = 'link'
  urlInput.value = url
  nextTick(inspectNow)
}

function onWindowPaste(e: ClipboardEvent) {
  // Normal pasting into other fields stays normal.
  if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')) return
  const pastedFile = e.clipboardData?.files?.[0]
  if (pastedFile) {
    e.preventDefault()
    useFile(pastedFile)
    return
  }
  const url = extractUrl(e.clipboardData?.getData('text'))
  if (url) {
    e.preventDefault()
    takeLink(url)
  }
}

onMounted(() => window.addEventListener('paste', onWindowPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onWindowPaste)
  clearTimeout(inspectTimer)
  abort?.abort()
  if (localUrl.value) URL.revokeObjectURL(localUrl.value)
})
</script>
