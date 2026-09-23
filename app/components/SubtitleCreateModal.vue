<template>
  <UModal v-model:open="open" title="New subtitle track" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
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

        <UTabs v-model="mode" :items="modeItems" :content="false" class="w-full" />

        <!-- From transcript -->
        <template v-if="mode === 'transcript'">
          <UFormField label="Transcript" required :hint="transcriptsLoading ? 'Loading…' : undefined">
            <USelect v-model="transcriptId" :items="transcriptOptions" placeholder="Choose a transcript" class="w-full" :disabled="!videoId" />
          </UFormField>
          <p v-if="videoId && !transcriptsLoading && !transcriptOptions.length" class="text-sm text-gray-500 dark:text-gray-400">
            This video has no transcripts with text yet.
            <NuxtLink :to="`/transcripts?videoId=${videoId}`" class="text-primary-600 dark:text-primary-400 hover:underline">Add one</NuxtLink>
            or upload a subtitle file instead.
          </p>
          <UFormField label="Readability rules" description="Cues are split and wrapped to fit these.">
            <SubtitleRulesFields v-model="rules" :language="selectedTranscript?.language" />
          </UFormField>
        </template>

        <!-- Upload -->
        <template v-else-if="mode === 'upload'">
          <label
            class="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
          >
            <UIcon name="i-lucide-file-up" class="w-6 h-6 text-gray-400" />
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ file?.name ?? 'Choose a .srt or .vtt file' }}</span>
            <span class="text-xs text-gray-500">UTF-8, up to {{ maxFileMb }} MB</span>
            <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" class="sr-only" @change="onFile" />
          </label>
          <UFormField label="Language" required>
            <USelectMenu
              v-model="language"
              aria-label="Language"
              :items="languageOptions(language)"
              value-key="value"
              placeholder="Choose a language"
              class="w-full"
            />
          </UFormField>
        </template>

        <!-- Empty -->
        <template v-else>
          <UFormField label="Language" required>
            <USelectMenu
              v-model="language"
              aria-label="Language"
              :items="languageOptions(language)"
              value-key="value"
              placeholder="Choose a language"
              class="w-full"
            />
          </UFormField>
          <p class="text-sm text-gray-500 dark:text-gray-400">Creates an empty track to fill in with the cue editor.</p>
        </template>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Label" hint="optional">
            <UInput v-model="label" :placeholder="labelPlaceholder" maxlength="100" class="w-full" />
          </UFormField>
          <UFormField label="Kind">
            <USelect v-model="kind" :items="SUBTITLE_KINDS.map((k) => ({ label: `${k.label} — ${k.description}`, value: k.value }))" class="w-full" />
          </UFormField>
        </div>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton type="submit" :loading="saving" :disabled="!canSubmit">{{
            mode === 'upload' ? 'Upload' : mode === 'transcript' ? 'Generate' : 'Create'
          }}</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { SubtitleRules } from '#shared/utils/subtitleQuality'
import { SUBTITLE_KINDS, type Subtitle, type SubtitleKind } from '~/composables/useSubtitles'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ defaultVideoId?: number }>()
const emit = defineEmits<{ created: [subtitle: Subtitle] }>()

const { list: listVideos } = useVideos()
const { list: listTranscripts } = useTranscripts()
const { create, upload } = useSubtitles()

// Settings › Storage (the backend enforces the same cap).
const { settings: clientSettings } = useClientSettings()
const maxFileMb = computed(() => clientSettings.value?.maxSubtitleUploadMb ?? 5)

const modeItems = [
  { label: 'From transcript', value: 'transcript', icon: 'i-lucide-captions' },
  { label: 'Upload file', value: 'upload', icon: 'i-lucide-file-up' },
  { label: 'Empty', value: 'empty', icon: 'i-lucide-file' }
]
const mode = ref<'transcript' | 'upload' | 'empty'>('transcript')

// ── Video ──────────────────────────────────────────────────────────────────
const videos = ref<{ id: number; title: string; language: string | null }[]>([])
const videosLoading = ref(false)
const videoId = ref<number | undefined>()
const videoOptions = computed(() => videos.value.map((v) => ({ label: v.title, value: v.id })))
const selectedVideo = computed(() => videos.value.find((v) => v.id === videoId.value))

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

// ── Transcript (generate mode) ─────────────────────────────────────────────
const transcripts = ref<{ id: number; language: string; segmentCount: number; source: string }[]>([])
const transcriptsLoading = ref(false)
const transcriptId = ref<number | undefined>()
const selectedTranscript = computed(() => transcripts.value.find((t) => t.id === transcriptId.value))
const transcriptOptions = computed(() => transcripts.value.map((t) => ({ label: `${languageLabel(t.language)} · ${t.segmentCount} segments`, value: t.id })))

watch(videoId, async (id) => {
  transcripts.value = []
  transcriptId.value = undefined
  if (!id) return
  language.value = selectedVideo.value?.language ?? defaultLanguageCode()
  transcriptsLoading.value = true
  try {
    // Empty transcripts can't be turned into subtitles, so they aren't offered.
    transcripts.value = (await listTranscripts({ videoId: id, size: 100 })).data.filter((t) => t.segmentCount > 0)
    // Prefer the spoken-language transcript.
    transcriptId.value = (transcripts.value.find((t) => t.language === selectedVideo.value?.language) ?? transcripts.value[0])?.id
  } catch {
    transcripts.value = []
  } finally {
    transcriptsLoading.value = false
  }
})

// ── Shared fields ──────────────────────────────────────────────────────────
const language = ref<string | undefined>()
const label = ref('')
const kind = ref<SubtitleKind>('SUBTITLES')
const rules = ref<SubtitleRules>(defaultSubtitleRules(null))
// Re-seed the rules when the chosen transcript's language changes (CJK vs. not).
watch(
  () => selectedTranscript.value?.language,
  (lang) => {
    rules.value = defaultSubtitleRules(lang)
  }
)

const effectiveLanguage = computed(() => (mode.value === 'transcript' ? selectedTranscript.value?.language : language.value))
const labelPlaceholder = computed(() => {
  const name = effectiveLanguage.value ? languageLabel(effectiveLanguage.value) : 'Language name'
  return kind.value === 'CAPTIONS' ? `${name} (captions)` : name
})

// ── Upload ─────────────────────────────────────────────────────────────────
const file = ref<File | null>(null)
function onFile(event: Event) {
  const picked = (event.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (picked && picked.size > maxFileMb.value * 1024 * 1024) {
    error.value = `That file is larger than ${maxFileMb.value} MB`
    file.value = null
    return
  }
  file.value = picked
}

// ── Submit ─────────────────────────────────────────────────────────────────
const saving = ref(false)
const error = ref('')
const canSubmit = computed(() => {
  if (!videoId.value) return false
  if (mode.value === 'transcript') return !!transcriptId.value && rules.value.maxDurationMs > rules.value.minDurationMs
  if (mode.value === 'upload') return !!file.value && !!language.value
  return !!language.value
})

async function onSubmit() {
  if (!canSubmit.value || !videoId.value) return
  saving.value = true
  error.value = ''
  try {
    const common = { videoId: videoId.value, label: label.value.trim() || undefined, kind: kind.value }
    const created =
      mode.value === 'upload'
        ? await upload({ ...common, file: file.value!, language: language.value! })
        : await create(
            mode.value === 'transcript' ? { ...common, transcriptId: transcriptId.value, rules: rules.value } : { ...common, language: language.value }
          )
    open.value = false
    emit('created', created)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

watch(open, async (value) => {
  if (!value) return
  error.value = ''
  mode.value = 'transcript'
  label.value = ''
  kind.value = 'SUBTITLES'
  file.value = null
  videoId.value = undefined
  if (!videos.value.length) await loadVideos()
  await nextTick()
  videoId.value = props.defaultVideoId
})
</script>
