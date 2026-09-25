<template>
  <UModal v-model:open="open" title="Download or import" :ui="{ content: 'sm:max-w-lg', body: 'space-y-5' }">
    <template #body>
      <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
      <div v-else-if="!data" class="space-y-3">
        <USkeleton class="h-9 w-full" />
        <USkeleton class="h-20 w-full" />
      </div>

      <template v-else>
        <UAlert v-if="video.importedFrom" color="info" variant="subtle" icon="i-lucide-hard-drive-download" title="Imported into your storage">
          <template #description>
            Originally from
            <a :href="video.importedFrom" target="_blank" rel="noopener" class="underline break-all">{{ video.importedFrom }}</a>
          </template>
        </UAlert>

        <!-- Jobs in progress, or the latest one if it failed -->
        <div v-for="job in visibleJobs" :key="job.id" class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
          <div class="flex items-center justify-between gap-2 text-sm">
            <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
            <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
          </div>
          <JobProgress :status="job.status" :progress="job.progress" :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep" />
        </div>

        <!-- Platforms only allow downloading with the owner's permission. -->
        <UCheckbox
          v-if="data.isLink && canWrite"
          v-model="rightsConfirmed"
          label="I own this video or have the owner's permission to download it"
          description="YouTube, Vimeo and Facebook don't allow downloading other people's videos without permission."
        />

        <!-- ── Download ─────────────────────────────────────────────── -->
        <section class="space-y-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-download" class="w-4 h-4 text-gray-400" />
            Download as MP4
          </h3>
          <UFormField v-if="audioOptions.length > 1" label="Sound">
            <USelect v-model="audio" :items="audioOptions" class="w-full" />
          </UFormField>
          <UFormField
            v-if="subtitleOptions.length > 1"
            label="Subtitles in the picture"
            :description="clientSettings?.requireApprovalToPublish ? 'Only approved tracks can be burned in.' : 'Drawn into the video, so they show in any player.'"
          >
            <USelect v-model="burnSubtitleId" :items="subtitleOptions" class="w-full" />
          </UFormField>
          <UAlert
            v-if="selectedTrack && selectedTrack.reviewStatus !== 'APPROVED'"
            color="warning"
            variant="subtle"
            icon="i-lucide-shield-alert"
            :title="`“${selectedTrack.label}” hasn't been approved in review`"
            description="Whatever it says now is baked into the file."
          />

          <!-- A file video with its own sound and no subtitles needs no job — it's already an MP4 somewhere. -->
          <UButton v-if="!data.isLink && audio === ORIGINAL && burnSubtitleId === NONE" block color="neutral" variant="soft" icon="i-lucide-download" :to="video.videoUrl" target="_blank">
            Download the original file
          </UButton>
          <template v-else-if="canWrite">
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ data.isLink ? `Fetched from ${sourceLabel} at up to 720p.` : 'Made from the video file.' }}
              {{ audio !== ORIGINAL ? 'The voice-over replaces the original sound.' : '' }}
              {{ burnSubtitleId !== NONE ? 'Burning in subtitles re-encodes the picture, so it takes longer.' : '' }}
              Ready in a few minutes and kept for 24 hours.
            </p>
            <UButton block icon="i-lucide-file-video" :loading="starting === 'FILE'" :disabled="!allowed || busy" @click="onStart('FILE')">
              Prepare download
            </UButton>
          </template>

          <ul v-if="data.exports.length" class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
            <li v-for="file in data.exports" :key="file.id" class="flex items-center gap-3 px-3 py-2">
              <UIcon name="i-lucide-file-video" class="w-5 h-5 text-primary-500 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate" :title="file.fileName">{{ file.fileName }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatFileSize(file.sizeBytes) }} · {{ file.audioLanguage ? `${languageLabel(file.audioLanguage)} voice-over` : 'original sound' }} ·
                  <template v-if="file.subtitleLabel">“{{ file.subtitleLabel }}” subtitles · </template>
                  <span :title="formatDateTime(file.expiresAt)">expires {{ formatRelativeTime(file.expiresAt) }}</span>
                </p>
              </div>
              <UButton size="xs" icon="i-lucide-download" :to="file.url" target="_blank">Save</UButton>
              <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Delete download" @click="onDelete(file)" />
            </li>
          </ul>
        </section>

        <!-- ── Import ───────────────────────────────────────────────── -->
        <section v-if="data.canImport && canWrite" class="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UIcon name="i-lucide-hard-drive-download" class="w-4 h-4 text-gray-400" />
            Import into your storage
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Copies the video (up to 720p) into your storage and plays it from there instead of {{ sourceLabel }} — it keeps working if the original is removed.
            Transcripts, subtitles and voice-overs stay attached.
          </p>
          <UButton
            block
            color="neutral"
            variant="soft"
            icon="i-lucide-hard-drive-download"
            :loading="starting === 'IMPORT'"
            :disabled="!allowed || busy"
            @click="onStart('IMPORT')"
          >
            Import video
          </UButton>
        </section>
      </template>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Download a video as MP4 (optionally with a voice-over as its sound), or
// import a YouTube/Vimeo/Facebook video into our storage. Both run as
// DOWNLOAD jobs; this polls them while open.
import type { DownloadMode, DownloadOverview, VideoExport } from '~/composables/useVideoDownloads'
import type { ProcessingJob } from '~/composables/useProcessingJobs'
import type { VideoDub } from '~/composables/useDubs'
import type { Video } from '~/composables/useVideos'
import type { Subtitle } from '~/composables/useSubtitles'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ video: Video; canWrite: boolean }>()
const emit = defineEmits<{ imported: [] }>()

const toast = useToast()
const { overview, start, remove } = useVideoDownloads()
const { overview: dubOverview } = useDubs()
const { list: listSubtitles } = useSubtitles()
const { settings: clientSettings } = useClientSettings()

const data = ref<DownloadOverview | null>(null)
const dubs = ref<VideoDub[]>([])
const error = ref('')

async function load() {
  error.value = ''
  try {
    data.value = await overview(props.video.id)
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}
async function loadDubs() {
  try {
    dubs.value = (await dubOverview(props.video.id)).dubs
  } catch {
    dubs.value = []
  }
}

// Tracks that can be burned in: approved first, then the rest by name.
const tracks = ref<Subtitle[]>([])
async function loadTracks() {
  try {
    tracks.value = (await listSubtitles({ videoId: props.video.id, size: 50, sortBy: 'label', sortOrder: 'asc' })).data
      .filter((t) => t.cueCount > 0 && (!clientSettings.value?.requireApprovalToPublish || t.reviewStatus === 'APPROVED'))
      .sort((a, b) => Number(b.reviewStatus === 'APPROVED') - Number(a.reviewStatus === 'APPROVED'))
  } catch {
    tracks.value = []
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  rightsConfirmed.value = false
  burnSubtitleId.value = NONE
  load()
  loadDubs()
  loadTracks()
})

const sourceLabel = computed(() => videoSourceMeta(props.video.source).label)

// ── Options ────────────────────────────────────────────────────────────────
const ORIGINAL = 'original'
const audio = ref(ORIGINAL)
const audioOptions = computed(() => [
  { label: 'Original sound', value: ORIGINAL },
  ...dubs.value.map((d) => ({ label: `${d.languageName} voice-over · ${d.voiceName}`, value: d.language }))
])
const NONE = 0
const burnSubtitleId = ref<number>(NONE)
const subtitleOptions = computed(() => [
  { label: 'None', value: NONE },
  ...tracks.value.map((t) => ({ label: `${t.label}${t.reviewStatus === 'APPROVED' ? ' · approved' : ''}`, value: t.id }))
])
const selectedTrack = computed(() => tracks.value.find((t) => t.id === burnSubtitleId.value) ?? null)
const rightsConfirmed = ref(false)
const allowed = computed(() => !data.value?.isLink || rightsConfirmed.value)

// ── Jobs ───────────────────────────────────────────────────────────────────
const visibleJobs = computed<ProcessingJob[]>(() => {
  const jobs = data.value?.jobs ?? []
  const active = jobs.filter((j) => isActiveJobStatus(j.status))
  const latest = jobs[0]
  return latest && latest.status === 'FAILED' ? [...active, latest] : active
})
const busy = computed(() => visibleJobs.value.some((j) => isActiveJobStatus(j.status)))

function jobMode(job: ProcessingJob): DownloadMode {
  try {
    return JSON.parse(job.parameters ?? '{}').mode === 'IMPORT' ? 'IMPORT' : 'FILE'
  } catch {
    return 'FILE'
  }
}
function jobLabel(job: ProcessingJob) {
  const what = jobMode(job) === 'IMPORT' ? 'Import' : 'Download'
  if (job.status === 'FAILED') return `${what} failed`
  return job.status === 'QUEUED' ? `${what} — waiting` : `${what} in progress`
}

let pollTimer: ReturnType<typeof setInterval> | undefined
watch([busy, open], ([isBusy, isOpen]) => {
  clearInterval(pollTimer)
  if (!isBusy || !isOpen) return
  pollTimer = setInterval(async () => {
    const running = visibleJobs.value.filter((j) => isActiveJobStatus(j.status))
    await load()
    for (const was of running) {
      const now = data.value?.jobs.find((j) => j.id === was.id)
      if (now?.status !== 'SUCCEEDED') continue
      if (jobMode(now) === 'IMPORT') {
        toast.add({ title: 'Video imported', description: 'It now plays from your storage.', color: 'success' })
        emit('imported')
      } else {
        toast.add({ title: 'Download ready', description: 'Click Save to download it.', color: 'success' })
      }
    }
  }, 3000)
})
onBeforeUnmount(() => clearInterval(pollTimer))

// ── Actions ────────────────────────────────────────────────────────────────
const starting = ref<DownloadMode | null>(null)
async function onStart(mode: DownloadMode) {
  starting.value = mode
  try {
    const job = await start(props.video.id, {
      mode,
      audio: mode === 'FILE' && audio.value !== ORIGINAL ? audio.value : null,
      subtitleId: mode === 'FILE' && burnSubtitleId.value !== NONE ? burnSubtitleId.value : null,
      rightsConfirmed: rightsConfirmed.value
    })
    toast.add({ title: `${mode === 'IMPORT' ? 'Import' : 'Download'} queued — job #${job.id}`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: `Could not start the ${mode === 'IMPORT' ? 'import' : 'download'}`, description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = null
  }
}

async function onDelete(file: VideoExport) {
  try {
    await remove(props.video.id, file.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete the download', description: apiErrorMessage(err), color: 'error' })
  }
}
</script>
