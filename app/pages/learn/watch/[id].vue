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
        <!-- The stage goes full screen as a whole, so captions and these controls stay with the video. -->
        <div
          ref="stage"
          class="overflow-hidden"
          :class="isFullscreen ? 'dark flex flex-col h-full bg-black' : 'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'"
        >
          <div :class="isFullscreen ? 'flex-1 min-h-0' : ''">
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
              :fill="isFullscreen"
              own-fullscreen
              :track-cues="primaryCues"
              :track-secondary="secondaryCues"
              :track-language="primaryTrack?.language"
              @time="onTime"
              @ended="tracker.onEnded"
            />
            <div v-else class="w-full aspect-video bg-black rounded-lg" />
          </div>

          <!-- Sentence controls -->
          <div
            class="flex flex-wrap items-center gap-1 px-3 py-2 border-t"
            :class="isFullscreen ? 'border-white/10 bg-black/80' : 'border-gray-100 dark:border-gray-800'"
          >
            <UTooltip text="Previous line (A)">
              <UButton color="neutral" variant="ghost" icon="i-lucide-skip-back" aria-label="Previous line" :disabled="!canStep" @click="previousLine" />
            </UTooltip>
            <UTooltip text="Replay this line (R)">
              <UButton color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" aria-label="Replay line" :disabled="!canStep" @click="replayLine" />
            </UTooltip>
            <UTooltip :text="isPlaying ? 'Pause (Space)' : 'Play (Space)'">
              <UButton
                color="neutral"
                variant="ghost"
                :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
                :aria-label="isPlaying ? 'Pause' : 'Play'"
                :disabled="!canControl"
                @click="player?.togglePlay()"
              />
            </UTooltip>
            <UTooltip text="Next line (D)">
              <UButton color="neutral" variant="ghost" icon="i-lucide-skip-forward" aria-label="Next line" :disabled="!canStep" @click="nextLine" />
            </UTooltip>
            <span class="mx-1 h-5 w-px" :class="isFullscreen ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'" />
            <UTooltip text="Keep repeating the current line (L)">
              <UButton
                :color="loopLine ? 'primary' : 'neutral'"
                :variant="loopLine ? 'soft' : 'ghost'"
                icon="i-lucide-repeat-1"
                :disabled="!canStep"
                @click="toggleLoop"
              >
                <span class="hidden sm:inline">Loop line</span>
              </UButton>
            </UTooltip>
            <UTooltip text="Pause at the end of every line, to repeat it out loud (P)">
              <UButton
                :color="pauseAfter ? 'primary' : 'neutral'"
                :variant="pauseAfter ? 'soft' : 'ghost'"
                icon="i-lucide-mic"
                :disabled="!canStep"
                @click="togglePauseAfter"
              >
                <span class="hidden sm:inline">Pause after lines</span>
              </UButton>
            </UTooltip>
            <div class="ml-auto flex items-center gap-1">
              <USelect v-model="speed" :items="SPEEDS" size="sm" class="w-20" aria-label="Speed ([ and ])" :disabled="!canControl" />
              <UTooltip :text="showCaptions ? 'Hide captions (C)' : 'Show captions (C)'">
                <UButton
                  :color="showCaptions ? 'primary' : 'neutral'"
                  :variant="showCaptions ? 'soft' : 'ghost'"
                  icon="i-lucide-captions"
                  :aria-label="showCaptions ? 'Hide captions' : 'Show captions'"
                  @click="showCaptions = !showCaptions"
                />
              </UTooltip>
              <UTooltip :text="isFullscreen ? 'Exit full screen (F)' : 'Full screen (F)'">
                <UButton
                  color="neutral"
                  variant="ghost"
                  :icon="isFullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
                  :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'"
                  @click="toggleFullscreen"
                />
              </UTooltip>
            </div>
          </div>

          <div v-if="!isFullscreen" class="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <USelect v-model="trackId" :items="trackOptions" size="sm" class="w-48" aria-label="Subtitles" :disabled="!page.tracks.length" />
            <USelect v-model="secondId" :items="secondOptions" size="sm" class="w-48" aria-label="Second language" :disabled="page.tracks.length < 2" />
            <USelect v-if="page.voiceOvers.length" v-model="voiceOver" :items="voiceOptions" size="sm" class="w-48" aria-label="Sound" />
            <UPopover>
              <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-keyboard" class="ml-auto">Shortcuts</UButton>
              <template #content>
                <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 p-3 text-sm">
                  <template v-for="k in SHORTCUT_HELP" :key="k.keys">
                    <dt><UKbd :value="k.keys" /></dt>
                    <dd class="text-gray-600 dark:text-gray-300">{{ k.label }}</dd>
                  </template>
                </dl>
              </template>
            </UPopover>
          </div>
        </div>

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
import type VideoPlayer from '~/components/VideoPlayer.vue'

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
// Typed explicitly: the template reads values derived from it, which would otherwise make its type circular.
const player = useTemplateRef<InstanceType<typeof VideoPlayer>>('player')
const currentMs = ref(0)
const isPlaying = computed(() => !!player.value?.playing)
const canControl = computed(() => !!player.value?.canControl)
function onTime(ms: number) {
  currentMs.value = ms
  tracker.onTime(ms)
  followLines(ms)
}
function seek(ms: number, play = true) {
  // Follow the line we land on — not the one we left, whose end we may be sitting on.
  pausedLine = null
  followed = lineAt(primaryCues.value, ms)
  player.value?.seek(ms, play)
  currentMs.value = ms
}

// ── Sentence controls ──────────────────────────────────────────────────────
// Stepping and looping go by the subtitle lines of the chosen track.
const canStep = computed(() => canControl.value && primaryCues.value.length > 0)
const loopLine = ref(false)
const pauseAfter = ref(false)
/** The line playback is in — checked against before moving on, so a line's end is never missed. */
let followed = -1
/** The line pause-after last paused on (so it pauses once, not on every tick). */
let pausedLine: number | null = null

function followLines(ms: number) {
  const cues = primaryCues.value
  if (!cues.length) return
  if (followed >= 0 && (loopLine.value || pauseAfter.value)) {
    const action = lineEndAction(cues, followed, ms, { loop: loopLine.value, pauseAfter: pauseAfter.value }, pausedLine)
    if (action.type === 'loop') return seek(action.toMs)
    if (action.type === 'pause') {
      pausedLine = action.line
      player.value?.pause()
      return
    }
  }
  followed = lineAt(cues, ms)
}

function previousLine() {
  const to = previousLineStart(primaryCues.value, currentMs.value)
  if (to !== null) seek(to, isPlaying.value || pauseAfter.value)
}
function nextLine() {
  // Stopped between lines by "pause after lines": the next line starts right here.
  if (pauseAfter.value && pausedLine !== null && !isPlaying.value) return player.value?.play()
  const to = nextLineStart(primaryCues.value, currentMs.value)
  if (to !== null) seek(to, isPlaying.value || pauseAfter.value)
}
function replayLine() {
  const to = currentLineStart(primaryCues.value, currentMs.value)
  if (to !== null) seek(to)
}
function toggleLoop() {
  loopLine.value = !loopLine.value
  if (loopLine.value) pauseAfter.value = false
}
function togglePauseAfter() {
  pauseAfter.value = !pauseAfter.value
  if (pauseAfter.value) loopLine.value = false
  pausedLine = null
}

// ── Speed (remembered in this browser) ─────────────────────────────────────
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5].map((v) => ({ label: `${v}×`, value: v }))
const SPEED_KEY = 'videolingo:speed'
const speed = ref(1)
watch(speed, (v) => {
  player.value?.setRate(v)
  try {
    localStorage.setItem(SPEED_KEY, String(v))
  } catch {
    // Only a convenience.
  }
})
// A (re)mounted player starts at 1×.
watch(player, (p) => p && speed.value !== 1 && p.setRate(speed.value))
function stepSpeed(dir: 1 | -1) {
  const i = SPEEDS.findIndex((s) => s.value === speed.value)
  const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + dir))]
  if (next) speed.value = next.value
}

// ── Full screen ────────────────────────────────────────────────────────────
// The stage (player + controls) goes full screen, not the video alone, so our
// captions stay visible. iPhones can only put a <video> itself full screen —
// there the video's own subtitle track (built from the same cues) takes over.
const stage = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
    return
  }
  const el = stage.value
  if (el?.requestFullscreen) {
    el.requestFullscreen().catch(() => {})
    return
  }
  const video = player.value?.videoEl as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null | undefined
  video?.webkitEnterFullscreen?.()
}
function onFullscreenChange() {
  isFullscreen.value = !!stage.value && document.fullscreenElement === stage.value
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

// ── Keyboard ───────────────────────────────────────────────────────────────
const SHORTCUT_HELP = [
  { keys: 'space', label: 'Play / pause' },
  { keys: '← →', label: 'Back / forward 5 seconds' },
  { keys: 'A D', label: 'Previous / next line' },
  { keys: 'R', label: 'Replay the line' },
  { keys: 'L', label: 'Loop the line' },
  { keys: 'P', label: 'Pause after each line' },
  { keys: '[ ]', label: 'Slower / faster' },
  { keys: 'C', label: 'Captions on / off' },
  { keys: 'F', label: 'Full screen' }
]
// When the <video> itself has focus, the browser already handles space and arrows.
const videoFocused = () => document.activeElement?.tagName === 'VIDEO'
defineShortcuts({
  ' ': () => !videoFocused() && player.value?.togglePlay(),
  arrowleft: () => !videoFocused() && seek(Math.max(0, currentMs.value - 5000), isPlaying.value),
  arrowright: () => !videoFocused() && seek(currentMs.value + 5000, isPlaying.value),
  a: () => canStep.value && previousLine(),
  d: () => canStep.value && nextLine(),
  r: () => canStep.value && replayLine(),
  l: () => canStep.value && toggleLoop(),
  p: () => canStep.value && togglePauseAfter(),
  c: () => (showCaptions.value = !showCaptions.value),
  f: () => toggleFullscreen(),
  '[': () => stepSpeed(-1),
  ']': () => stepSpeed(1)
})

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
const textAt = (cues: LearnCue[]) => {
  const i = activeCueIndex(cues, currentMs.value)
  return i >= 0 ? cues[i]!.text : null
}
const primaryLine = computed(() => textAt(primaryCues.value))
const secondaryLine = computed(() => textAt(secondaryCues.value))

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
onMounted(() => {
  try {
    const saved = Number(localStorage.getItem(SPEED_KEY))
    if (SPEEDS.some((x) => x.value === saved)) speed.value = saved
  } catch {
    // Default speed.
  }
  load()
})
</script>
