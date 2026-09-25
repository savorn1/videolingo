<template>
  <div>
    <PageHeader
      :title="page?.video.title ?? 'Video'"
      :description="description"
      :crumbs="[{ label: 'Learn', to: '/learn' }, { label: page?.video.title ?? '…' }]"
    >
      <template v-if="page" #actions>
        <UButton
          :color="tracker.progress.value?.completed ? 'success' : 'neutral'"
          variant="soft"
          :icon="tracker.progress.value?.completed ? 'i-lucide-circle-check' : 'i-lucide-circle'"
          :loading="marking"
          @click="toggleWatched"
        >
          {{ tracker.progress.value?.completed ? 'Watched' : 'Mark as watched' }}
        </UButton>
        <UButton v-if="can('videos', 'READ')" color="neutral" variant="ghost" icon="i-lucide-settings-2" :to="`/videos/${page.video.id}`">Manage</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/learn">Back to Learn</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading" :fields="3" />

    <div v-else-if="page" class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <div class="xl:col-span-2 space-y-4">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <VideoPlayer
            v-if="tracker.ready.value"
            ref="player"
            :embed-url="page.video.embedUrl"
            :video-url="page.video.videoUrl"
            :poster="page.video.thumbnailUrl"
            :title="page.video.title"
            :vertical="!!page.video.width && !!page.video.height && page.video.height > page.video.width"
            :resume-key="page.video.id"
            :start-at="tracker.startAt.value"
            :dub-url="voiceOver || null"
            :caption="showCaptions ? primaryLine : null"
            :caption-secondary="showCaptions ? secondaryLine : null"
            @time="onTime"
            @ended="tracker.onEnded"
          />
          <div v-else class="w-full aspect-video bg-black rounded-lg" />

          <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <USelect v-model="trackId" :items="trackOptions" size="sm" class="w-48" aria-label="Subtitles" :disabled="!page.tracks.length" />
            <USelect v-model="secondId" :items="secondOptions" size="sm" class="w-48" aria-label="Second language" :disabled="page.tracks.length < 2" />
            <USelect v-if="page.voiceOvers.length" v-model="voiceOver" :items="voiceOptions" size="sm" class="w-48" aria-label="Sound" />
            <USwitch v-model="showCaptions" size="sm" label="Captions on video" class="ml-auto" />
          </div>
        </UCard>

        <StudyPanel :video-id="page.video.id" :items="studyItems" :preferred-language="secondTrack?.language ?? primaryTrack?.language" @seek="seek" />
        <UCard v-if="!studyItems.length">
          <p class="text-sm text-gray-500">No summary or quiz for this video yet.</p>
        </UCard>
      </div>

      <UCard :ui="{ body: 'p-0 sm:p-0' }" class="xl:sticky xl:top-4">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white">Transcript</h2>
            <span class="text-xs text-gray-500">Click a word to look it up</span>
          </div>
        </template>
        <InteractiveTranscript
          :cues="primaryCues"
          :language="primaryTrack?.language"
          :secondary-cues="secondaryCues"
          :current-ms="currentMs"
          @seek="seek"
          @lookup="openLookup"
        />
      </UCard>
    </div>

    <WordLookupModal
      v-if="page"
      v-model:open="lookupOpen"
      :word="lookupWord.word"
      :language="primaryTrack?.language ?? page.video.language ?? 'en'"
      :context="lookupWord.context"
      :video-id="page.video.id"
      :at-ms="lookupWord.atMs"
      :suggested-target="secondTrack?.language"
    />
  </div>
</template>

<script setup lang="ts">
// Watching as a learner: subtitles on the video (optionally two languages),
// a clickable transcript that follows along, word lookup into flashcards,
// voice-overs, AI study material, and progress saved to the account.
import type { LearnCue, StudyItem, WatchPage } from '~/composables/useLearn'

const route = useRoute()
const { watch: getWatchPage, cues: getCues, study } = useLearn()
const { setCompleted } = useWatchProgress()
const { can } = useAuth()
const toast = useToast()
const tracker = useProgressTracker()

const id = computed(() => Number(route.params.id))
const page = ref<WatchPage | null>(null)
const studyItems = ref<StudyItem[]>([])
const loading = ref(true)
const error = ref('')

const description = computed(() => {
  const v = page.value?.video
  if (!v) return undefined
  return [languageLabel(v.language), v.durationSeconds ? formatDuration(v.durationSeconds) : '', v.sourceAuthor ? `by ${v.sourceAuthor}` : '']
    .filter(Boolean)
    .join(' · ')
})

// ── Player ─────────────────────────────────────────────────────────────────
const player = useTemplateRef('player')
const currentMs = ref(0)
function onTime(ms: number) {
  currentMs.value = ms
  tracker.onTime(ms)
}
function seek(ms: number) {
  player.value?.seek(ms)
  currentMs.value = ms
}

// ── Subtitles ──────────────────────────────────────────────────────────────
const NONE = 0
const trackId = ref<number>(NONE)
const secondId = ref<number>(NONE)
const showCaptions = ref(true)
const cueCache = new Map<number, LearnCue[]>()
const primaryCues = ref<LearnCue[]>([])
const secondaryCues = ref<LearnCue[]>([])
const primaryTrack = computed(() => page.value?.tracks.find((t) => t.id === trackId.value) ?? null)
const secondTrack = computed(() => page.value?.tracks.find((t) => t.id === secondId.value) ?? null)
const trackOptions = computed(() => [
  { label: page.value?.tracks.length ? 'No subtitles' : 'No subtitles yet', value: NONE },
  ...(page.value?.tracks ?? []).map((t) => ({ label: t.label, value: t.id }))
])
const secondOptions = computed(() => [
  { label: 'No second language', value: NONE },
  ...(page.value?.tracks ?? []).filter((t) => t.id !== trackId.value).map((t) => ({ label: `Also: ${t.label}`, value: t.id }))
])

async function cuesOf(id: number) {
  if (!cueCache.has(id)) cueCache.set(id, await getCues(id))
  return cueCache.get(id)!
}
watch(trackId, async (tid) => {
  if (secondId.value === tid) secondId.value = NONE
  primaryCues.value = tid === NONE ? [] : await cuesOf(tid).catch(() => [])
})
watch(secondId, async (sid) => {
  secondaryCues.value = sid === NONE ? [] : await cuesOf(sid).catch(() => [])
})
const lineAt = (cues: LearnCue[]) => {
  const i = activeCueIndex(cues, currentMs.value)
  return i >= 0 ? cues[i]!.text : null
}
const primaryLine = computed(() => lineAt(primaryCues.value))
const secondaryLine = computed(() => lineAt(secondaryCues.value))

// ── Voice-over ─────────────────────────────────────────────────────────────
// '' = the original sound.
const voiceOver = ref('')
const voiceOptions = computed(() => [
  { label: 'Original sound', value: '' },
  ...(page.value?.voiceOvers ?? []).map((d) => ({ label: `${d.languageName} voice-over`, value: d.audioUrl }))
])

// ── Word lookup ────────────────────────────────────────────────────────────
const lookupOpen = ref(false)
const lookupWord = reactive({ word: '', context: '', atMs: 0 })
function openLookup(e: { word: string; context: string; atMs: number }) {
  Object.assign(lookupWord, e)
  lookupOpen.value = true
}

// ── Watched ────────────────────────────────────────────────────────────────
const marking = ref(false)
async function toggleWatched() {
  if (!page.value) return
  marking.value = true
  try {
    tracker.progress.value = await setCompleted(page.value.video.id, !tracker.progress.value?.completed)
  } catch (err) {
    toast.add({ title: 'Could not update', description: apiErrorMessage(err), color: 'error' })
  } finally {
    marking.value = false
  }
}

// ── Load ───────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value = ''
  try {
    page.value = await getWatchPage(id.value)
    const t = Number(route.query.t)
    tracker.start(page.value.video.id, page.value.video.durationSeconds, Number.isFinite(t) && t > 0 ? t / 1000 : null)
    // The default track, else one in the video's own language, else the first.
    const tracks = page.value.tracks
    const first = tracks.find((t) => t.isDefault) ?? tracks.find((t) => t.language === page.value!.video.language) ?? tracks[0]
    trackId.value = first?.id ?? NONE
    study(id.value)
      .then((s) => (studyItems.value = s))
      .catch(() => (studyItems.value = []))
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

watch(id, load)
onMounted(load)
</script>
