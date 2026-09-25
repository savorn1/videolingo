<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-gray-900 dark:text-white">Voice-over</h2>
          <UBadge v-if="data?.dubs.length" color="neutral" variant="subtle" size="sm">{{ data.dubs.length }}</UBadge>
        </div>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="loading" aria-label="Refresh" @click="load" />
      </div>
    </template>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
    <div v-else-if="!data" class="space-y-3">
      <USkeleton class="h-9 w-full" />
      <USkeleton class="h-9 w-2/3" />
    </div>

    <template v-else>
      <!-- Which sound the player uses -->
      <UFormField v-if="data.dubs.length" label="Audio">
        <USelect v-model="selected" :items="audioOptions" class="w-full" icon="i-lucide-volume-2" />
      </UFormField>

      <!-- Jobs being worked on, or the last one that failed -->
      <div v-for="job in visibleJobs" :key="job.id" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
          <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
        </div>
        <JobProgress :status="job.status" :progress="job.progress" :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep" />
      </div>

      <!-- Existing tracks -->
      <ul v-if="data.dubs.length" class="divide-y divide-gray-100 dark:divide-gray-800 -mx-1">
        <li v-for="dub in data.dubs" :key="dub.id" class="flex items-center gap-3 px-1 py-2">
          <span
            class="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400"
          >
            <UIcon name="i-lucide-mic" class="w-4 h-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ dub.languageName }} · {{ dub.voiceName }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatDuration(Math.round(dub.durationMs / 1000)) }} · {{ formatFileSize(dub.sizeBytes) }} ·
              <span :title="formatDateTime(dub.updatedAt)">{{ formatRelativeTime(dub.updatedAt) }}</span>
            </p>
          </div>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" :to="dub.audioUrl" target="_blank" aria-label="Download audio" />
          <UButton
            v-if="canWrite"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            aria-label="Delete voice track"
            @click="confirmDelete = dub"
          />
        </li>
      </ul>

      <!-- Make one -->
      <div v-if="canWrite" class="space-y-3" :class="data.dubs.length || visibleJobs.length ? 'pt-3 border-t border-gray-100 dark:border-gray-800' : ''">
        <UAlert
          v-if="setupNotes.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-plug"
          title="Server setup needed"
          :description="setupNotes.join(' ')"
        />
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Language">
            <USelect v-model="form.language" :items="languageOptions" class="w-full" />
          </UFormField>
          <UFormField label="Voice">
            <USelect v-model="form.voice" :items="voiceOptions" class="w-full" />
          </UFormField>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ plan }}</p>
        <UButton block icon="i-lucide-mic" :loading="creating" :disabled="!data.textToSpeechReady || !form.language || busyLanguage" @click="onCreate">
          {{ existing ? `Redo ${languageLabel(form.language)} voice-over` : `Create ${languageLabel(form.language)} voice-over` }}
        </UButton>
      </div>
      <p v-else-if="!data.dubs.length" class="text-sm text-gray-500 dark:text-gray-400">No voice-over yet.</p>
    </template>

    <ConfirmModal
      :model-value="!!confirmDelete"
      title="Delete voice track"
      :description="`Delete the ${confirmDelete?.languageName ?? ''} voice-over? Its audio file is removed too.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(open: boolean) => !open && (confirmDelete = null)"
      @confirm="onDelete"
    />
  </UCard>
</template>

<script setup lang="ts">
// A video's voice-over tracks: pick which audio the player uses, and (with
// write access) make one — the server transcribes and translates first when
// the text isn't there yet, then records each line with the chosen voice.
import type { DubOverview, VideoDub } from '~/composables/useDubs'
import type { ProcessingJob } from '~/composables/useProcessingJobs'

const props = defineProps<{ videoId: number; canWrite: boolean }>()
/** The chosen dub's audio URL, or null for the original sound. */
const dubUrl = defineModel<string | null>({ default: null })

const toast = useToast()
const { overview, create, remove } = useDubs()

const data = ref<DubOverview | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await overview(props.videoId)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// ── Audio choice ───────────────────────────────────────────────────────────
const ORIGINAL = 'original'
const selected = computed({
  get: () => data.value?.dubs.find((d) => d.audioUrl === dubUrl.value)?.id.toString() ?? ORIGINAL,
  set: (value: string) => {
    dubUrl.value = value === ORIGINAL ? null : (data.value?.dubs.find((d) => d.id.toString() === value)?.audioUrl ?? null)
  }
})
const audioOptions = computed(() => [
  { label: `Original${data.value?.spokenLanguage ? ` (${languageLabel(data.value.spokenLanguage)})` : ''}`, value: ORIGINAL },
  ...(data.value?.dubs ?? []).map((d) => ({ label: `${d.languageName} voice-over · ${d.voiceName}`, value: d.id.toString() }))
])
// A deleted or replaced track can't stay selected.
watch(
  () => data.value?.dubs,
  (dubs) => {
    if (dubUrl.value && !dubs?.some((d) => d.audioUrl === dubUrl.value)) dubUrl.value = null
  }
)

// ── Jobs ───────────────────────────────────────────────────────────────────
// Running/queued jobs, plus the newest one if it failed (so the reason shows).
const visibleJobs = computed<ProcessingJob[]>(() => {
  const jobs = data.value?.jobs ?? []
  const active = jobs.filter((j) => isActiveJobStatus(j.status))
  const latest = jobs[0]
  return latest && latest.status === 'FAILED' ? [...active, latest] : active
})
function jobParams(job: ProcessingJob): { language?: string; voice?: string } {
  try {
    return job.parameters ? JSON.parse(job.parameters) : {}
  } catch {
    return {}
  }
}
function jobLabel(job: ProcessingJob) {
  const lang = jobParams(job).language
  const what = `${lang ? languageLabel(lang) : ''} voice-over`.trim()
  return job.status === 'FAILED' ? `${what} failed` : job.status === 'QUEUED' ? `${what} — waiting` : `Making ${what}`
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch(
  () => visibleJobs.value.some((j) => isActiveJobStatus(j.status)),
  (active) => {
    clearInterval(pollTimer)
    if (!active) return
    pollTimer = setInterval(async () => {
      const wasActive = new Set(visibleJobs.value.filter((j) => isActiveJobStatus(j.status)).map((j) => j.id))
      await load()
      if ((data.value?.jobs ?? []).some((j) => wasActive.has(j.id) && j.status === 'SUCCEEDED'))
        toast.add({ title: 'Voice-over ready', description: 'Choose it under Audio to listen.', color: 'success' })
    }, 3000)
  }
)
onBeforeUnmount(() => clearInterval(pollTimer))

// ── Create ─────────────────────────────────────────────────────────────────
const form = reactive({ language: 'km', voice: '' })
const languageOptions = computed(() => Object.keys(data.value?.voices ?? {}).map((code) => ({ label: languageLabel(code), value: code })))
const voiceOptions = computed(() => (data.value?.voices[form.language] ?? []).map((v) => ({ label: `${v.name} (${v.gender.toLowerCase()})`, value: v.id })))
watch(
  voiceOptions,
  (options) => {
    if (!options.some((o) => o.value === form.voice)) form.voice = options[0]?.value ?? ''
  },
  { immediate: true }
)
const existing = computed(() => data.value?.dubs.find((d) => d.language === form.language))
const busyLanguage = computed(() => visibleJobs.value.some((j) => isActiveJobStatus(j.status) && jobParams(j).language === form.language))

const plan = computed(() => {
  const spoken = data.value?.spokenLanguage
  const target = languageLabel(form.language)
  if (!spoken) return `Uses the ${target} transcript if there is one; otherwise set the video's spoken language first.`
  if (spoken === form.language) return `Reads the ${target} transcript aloud (transcribing the video first if needed).`
  return `Uses the ${target} transcript if there is one; otherwise transcribes the ${languageLabel(spoken)} audio and translates it first. Each line is spoken at its original time.`
})

const setupNotes = computed(() => {
  const d = data.value
  if (!d) return []
  const notes: string[] = []
  if (!d.textToSpeechReady) notes.push('Voices need an Azure Speech key (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION).')
  if (!d.speechToTextReady) notes.push('Transcribing needs an OpenAI key (OPENAI_API_KEY) — only when there is no transcript yet.')
  if (!d.translationReady) notes.push('Translating needs Claude to be set up and switched on in Settings › AI.')
  return notes
})

const creating = ref(false)
async function onCreate() {
  creating.value = true
  try {
    const job = await create(props.videoId, { language: form.language, voice: form.voice || undefined })
    toast.add({ title: `Voice-over queued — job #${job.id}`, description: 'This page updates as it progresses.', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not start the voice-over', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creating.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
const confirmDelete = ref<VideoDub | null>(null)
const deleting = ref(false)
async function onDelete() {
  const dub = confirmDelete.value
  if (!dub) return
  deleting.value = true
  try {
    await remove(props.videoId, dub.id)
    confirmDelete.value = null
    toast.add({ title: 'Voice track deleted', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete the voice track', description: apiErrorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

watch(() => props.videoId, load)
onMounted(load)
</script>
