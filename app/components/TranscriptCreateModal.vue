<template>
  <UModal v-model:open="open" title="New transcript" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Video" required>
            <USelectMenu
              v-model="videoId"
              aria-label="Video"
              :items="videoOptions"
              value-key="value"
              placeholder="Choose a video"
              :loading="videosLoading"
              :search-input="{ placeholder: 'Search videos…' }"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Language" required :hint="languageHint">
            <USelectMenu v-model="language" aria-label="Language" :items="languageItems" value-key="value" placeholder="Choose a language" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Content">
          <UTabs v-model="mode" :items="modeItems" :content="false" class="w-full" />
        </UFormField>

        <div v-if="mode === 'file'" class="space-y-2">
          <label
            class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
          >
            <UIcon name="i-lucide-file-up" class="w-6 h-6 text-gray-400" />
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ fileName ?? 'Choose a .srt, .vtt or .txt file' }}</span>
            <span class="text-xs text-gray-500">UTF-8, up to 5 MB</span>
            <input type="file" accept=".srt,.vtt,.txt,text/vtt,text/plain,application/x-subrip" class="sr-only" @change="onFile" />
          </label>
        </div>
        <UTextarea
          v-else-if="mode === 'paste'"
          v-model="pasted"
          :rows="8"
          class="w-full font-mono"
          placeholder="Paste SRT or WebVTT — or plain text, one line per segment"
        />
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">Creates an empty transcript you can fill in with the editor, or regenerate automatically.</p>

        <!-- Import preview -->
        <div v-if="parsed && mode !== 'empty'" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <UBadge color="neutral" variant="subtle">{{ FORMAT_LABEL[parsed.format] }}</UBadge>
            <span class="font-semibold text-gray-900 dark:text-white">{{ parsed.segments.length }} segment{{ parsed.segments.length === 1 ? '' : 's' }}</span>
            <span v-if="parsed.segments.length" class="text-gray-500">· ends at {{ formatTimestamp(parsed.segments.at(-1)!.endMs) }}</span>
          </div>
          <ol v-if="parsed.segments.length" class="text-xs font-mono space-y-1 text-gray-700 dark:text-gray-300">
            <li v-for="(s, i) in parsed.segments.slice(0, 3)" :key="i" class="truncate">
              <span class="text-gray-400">{{ formatTimestamp(s.startMs) }}</span> {{ s.speaker ? `${s.speaker}: ` : '' }}{{ s.text.replace(/\n/g, ' ') }}
            </li>
            <li v-if="parsed.segments.length > 3" class="text-gray-400">… and {{ parsed.segments.length - 3 }} more</li>
          </ol>
          <UAlert
            v-if="parsed.warnings.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="parsed.warnings.length === 1 ? parsed.warnings[0] : `${parsed.warnings.length} notes about this import`"
          >
            <template v-if="parsed.warnings.length > 1" #description>
              <ul class="list-disc pl-4 max-h-24 overflow-auto">
                <li v-for="(w, i) in parsed.warnings" :key="i">{{ w }}</li>
              </ul>
            </template>
          </UAlert>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton type="submit" :loading="saving" :disabled="!canSubmit">Create transcript</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ParsedSubtitles, SubtitleFormat } from '#shared/utils/subtitles'
import type { Transcript } from '~/composables/useTranscripts'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ defaultVideoId?: number }>()
const emit = defineEmits<{ created: [transcript: Transcript] }>()

const { list: listVideos } = useVideos()
const { list: listTranscripts, create } = useTranscripts()

const FORMAT_LABEL: Record<SubtitleFormat, string> = { srt: 'SubRip', vtt: 'WebVTT', text: 'Plain text' }
const MAX_FILE_BYTES = 5 * 1024 * 1024

// ── Video + language ───────────────────────────────────────────────────────
const videos = ref<{ id: number; title: string; language: string | null }[]>([])
const videosLoading = ref(false)
const videoId = ref<number | undefined>()
const language = ref<string | undefined>()
// Languages this video already has a transcript in (one per language).
const takenLanguages = ref<string[]>([])

const videoOptions = computed(() => videos.value.map((v) => ({ label: v.title, value: v.id })))
const selectedVideo = computed(() => videos.value.find((v) => v.id === videoId.value))
// Settings › Translation's suggested languages are listed first.
const { settings: clientSettings } = useClientSettings()
const suggested = computed(() => clientSettings.value?.defaultTargetLanguages ?? [])
const languageItems = computed(() => {
  const items = languageOptions(language.value).map((o) => ({
    ...o,
    label:
      o.value === selectedVideo.value?.language ? `${o.label} (spoken)` : o.value && suggested.value.includes(o.value) ? `${o.label} (suggested)` : o.label,
    disabled: !!o.value && takenLanguages.value.includes(o.value)
  }))
  const rank = (v: string | undefined) => (v === selectedVideo.value?.language ? 0 : v && suggested.value.includes(v) ? 1 : 2)
  return items.sort((a, b) => rank(a.value) - rank(b.value))
})
const languageHint = computed(() => (takenLanguages.value.length ? `Already has: ${takenLanguages.value.map(languageLabel).join(', ')}` : undefined))

async function loadVideos() {
  videosLoading.value = true
  try {
    videos.value = (await listVideos({ size: 500, sortBy: 'title', sortOrder: 'asc' })).data
  } catch {
    videos.value = []
  } finally {
    videosLoading.value = false
  }
}

watch(videoId, async (id) => {
  takenLanguages.value = []
  if (!id) return
  // Default to the video's spoken language — the usual first transcript —
  // or the platform default when the video has none set.
  const spoken = selectedVideo.value?.language ?? defaultLanguageCode()
  try {
    takenLanguages.value = (await listTranscripts({ videoId: id, size: 100 })).data.map((t) => t.language)
  } catch {
    takenLanguages.value = []
  }
  if (!language.value || takenLanguages.value.includes(language.value)) {
    language.value = spoken && !takenLanguages.value.includes(spoken) ? spoken : undefined
  }
})

// ── Content ────────────────────────────────────────────────────────────────
const modeItems = [
  { label: 'Start empty', value: 'empty', icon: 'i-lucide-file' },
  { label: 'Import file', value: 'file', icon: 'i-lucide-file-up' },
  { label: 'Paste text', value: 'paste', icon: 'i-lucide-clipboard' }
]
const mode = ref<'empty' | 'file' | 'paste'>('empty')
const fileName = ref<string | null>(null)
const fileText = ref('')
const pasted = ref('')

async function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  if (file.size > MAX_FILE_BYTES) {
    error.value = 'That file is larger than 5 MB'
    return
  }
  fileName.value = file.name
  fileText.value = await file.text()
}

const parsed = computed<ParsedSubtitles | null>(() => {
  const text = mode.value === 'file' ? fileText.value : mode.value === 'paste' ? pasted.value : ''
  return text.trim() ? parseSubtitles(text) : null
})

// ── Submit ─────────────────────────────────────────────────────────────────
const saving = ref(false)
const error = ref('')

const canSubmit = computed(() => {
  if (!videoId.value || !language.value) return false
  if (mode.value === 'empty') return true
  return !!parsed.value && parsed.value.segments.length > 0
})

async function onSubmit() {
  if (!canSubmit.value || !videoId.value || !language.value) return
  saving.value = true
  error.value = ''
  try {
    const segments = mode.value === 'empty' ? [] : (parsed.value?.segments ?? [])
    const created = await create({
      videoId: videoId.value,
      language: language.value,
      source: mode.value === 'empty' ? 'MANUAL' : 'IMPORTED',
      segments
    })
    open.value = false
    emit('created', created)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

// Fresh form each time it opens. videoId is cleared first so the watcher above
// always re-runs — reopening for the same video must re-check which languages
// it already has (one may have just been created).
watch(open, async (value) => {
  if (!value) return
  error.value = ''
  mode.value = 'empty'
  fileName.value = null
  fileText.value = ''
  pasted.value = ''
  language.value = undefined
  videoId.value = undefined
  if (!videos.value.length) await loadVideos()
  await nextTick()
  videoId.value = props.defaultVideoId
})
</script>
