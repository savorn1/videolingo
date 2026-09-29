<template>
  <div>
    <WatchHeader
      v-if="page"
      :page="page"
      :progress="tracker.progress.value"
      :current-ms="currentMs"
      :study-items="studyItems"
      :marking="marking"
      :course="course"
      :prev-item="prevItem"
      :next-item="nextItem"
      :link-to="linkTo"
      @toggle-watched="toggleWatched"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/learn">Back to Learn</UButton>
      </template>
    </UAlert>

    <!-- Shaped like the real layout, so nothing jumps around once the data arrives. -->
    <div v-if="loading" class="space-y-4">
      <div class="space-y-2">
        <USkeleton class="h-7 w-2/3" />
        <div class="flex flex-wrap gap-1.5">
          <USkeleton class="h-5 w-16 rounded-full" />
          <USkeleton class="h-5 w-14 rounded-full" />
          <USkeleton class="h-5 w-20 rounded-full" />
        </div>
        <USkeleton class="h-4 w-48" />
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div class="xl:col-span-2 space-y-4">
          <div class="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <USkeleton class="w-full aspect-video rounded-none" />
            <div class="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 dark:border-gray-800">
              <USkeleton v-for="n in 6" :key="n" class="h-8 w-8 rounded-md" />
            </div>
          </div>
          <USkeleton class="h-56 w-full rounded-lg" />
        </div>
        <div class="space-y-2">
          <USkeleton class="h-6 w-28" />
          <USkeleton v-for="n in 5" :key="n" class="h-14 w-full rounded-lg" />
        </div>
      </div>
    </div>

    <div v-else-if="page" class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <div class="xl:col-span-2 space-y-4">
        <!-- The stage goes full screen as a whole, so captions and these controls stay with the video. -->
        <div
          ref="stage"
          class="overflow-hidden"
          :class="isFullscreen ? 'dark flex flex-col h-full bg-black' : 'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'"
          @mousemove="wakeControls"
          @touchstart="wakeControls"
          @click="wakeControls"
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
              :fill="isFullscreen"
              own-fullscreen
              :track-cues="primaryCues"
              :track-secondary="secondaryCues"
              :track-language="primaryTrack?.language"
              @time="onTime"
              @ended="onEnded"
            >
              <template #overlay="{ fill }">
                <CaptionOverlay
                  v-if="showCaptions"
                  :primary-cues="primaryCues"
                  :secondary-cues="secondaryCues"
                  :current-ms="currentMs"
                  :language="primaryTrack?.language"
                  :caption-style="prefs.captionStyle"
                  :practice="prefs.practice"
                  :word-highlight="prefs.wordHighlight"
                  :glossary-terms="glossaryTerms"
                  :fill="fill"
                  @hover="onCaptionHover"
                  @lookup="openLookup"
                />

                <!-- The video ended: what to do next, instead of just sitting there. -->
                <div v-if="finished" class="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-6">
                  <div class="text-center text-white space-y-4 max-w-sm">
                    <UIcon name="i-lucide-party-popper" class="w-9 h-9 mx-auto text-success-400" />
                    <template v-if="nextItem">
                      <div>
                        <p class="text-sm text-white/70">Next in {{ course?.collection.title }}</p>
                        <p class="font-semibold line-clamp-2">{{ nextItem.title ?? `Video #${nextItem.videoId}` }}</p>
                      </div>
                      <div class="flex flex-wrap justify-center gap-2">
                        <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="watchAgain">Watch again</UButton>
                        <UButton icon="i-lucide-skip-forward" :to="linkTo(nextItem.videoId)">Play next</UButton>
                      </div>
                    </template>
                    <template v-else-if="courseFinished">
                      <UIcon name="i-lucide-trophy" class="w-9 h-9 mx-auto text-warning-400 -mt-1" />
                      <div>
                        <p class="font-semibold">Course complete!</p>
                        <p class="text-sm text-white/70">You've finished every video in {{ course?.collection.title }}.</p>
                      </div>
                      <div class="flex flex-wrap justify-center gap-2">
                        <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="watchAgain">Watch again</UButton>
                        <UButton icon="i-lucide-list-video" :to="`/learn/collections/${course?.collection.id}`" @click="finished = false">
                          Back to course
                        </UButton>
                      </div>
                    </template>
                    <template v-else>
                      <p class="font-semibold">Nice work — you've finished this video.</p>
                      <div class="flex flex-wrap justify-center gap-2">
                        <UButton color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="watchAgain">Watch again</UButton>
                        <UButton v-if="hasQuiz" icon="i-lucide-circle-help" @click="goToQuiz">Take the quiz</UButton>
                        <UButton v-else color="primary" variant="soft" icon="i-lucide-compass" to="/learn" @click="finished = false">
                          Browse more videos
                        </UButton>
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </VideoPlayer>
            <div v-else class="w-full aspect-video bg-black rounded-lg" />
          </div>

          <!-- One control bar: line-by-line playback, subtitles, speed and full
               screen. Fades out in full screen after a moment of no movement,
               like any video player — hover or move to bring it back. -->
          <div
            class="flex flex-wrap items-center gap-1 px-3 py-2 border-t transition-opacity duration-300"
            :class="[
              isFullscreen ? 'border-white/10 bg-black/80' : 'border-gray-100 dark:border-gray-800',
              controlsHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
            ]"
            @mouseenter="pauseAutoHide"
            @mouseleave="scheduleHide"
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
                <span class="hidden lg:inline">Loop</span>
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
                <span class="hidden lg:inline">Pause after</span>
              </UButton>
            </UTooltip>

            <span class="mx-1 h-5 w-px hidden sm:block" :class="isFullscreen ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'" />

            <SubtitleToolbar
              v-model:track-id="trackId"
              v-model:second-id="secondId"
              :track-options="trackOptions"
              :second-options="secondOptions"
              :offset-ms="offsetMs"
              :step="OFFSET_STEP"
              :current-ms="currentMs"
              :primary-label="primaryTrack?.label"
              @nudge="nudge"
              @reset-offset="resetOffset"
            >
              <template #extra>
                <template v-if="page.voiceOvers.length">
                  <USeparator label="Sound" />
                  <UFormField label="Sound">
                    <USelect v-model="voiceOver" :items="voiceOptions" size="sm" class="w-full" />
                  </UFormField>
                </template>
                <USeparator label="Keyboard shortcuts" />
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <template v-for="k in SHORTCUT_HELP" :key="k.keys">
                    <dt><UKbd :value="k.keys" /></dt>
                    <dd class="text-gray-600 dark:text-gray-300">{{ k.label }}</dd>
                  </template>
                </dl>
              </template>
            </SubtitleToolbar>

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
              <ShortcutsHelp :items="SHORTCUT_HELP" />
            </div>
          </div>
        </div>

        <PracticePanel :cues="primaryCues" :current-ms="currentMs" :language="primaryTrack?.language ?? page.video.language" @play="playLine" />

        <div ref="studyPanelEl">
          <StudyPanel :video-id="page.video.id" :items="studyItems" :preferred-language="secondTrack?.language ?? primaryTrack?.language" @seek="seek" />
          <UCard v-if="!studyItems.length">
            <p class="text-sm text-gray-500">No summary or quiz for this video yet.</p>
          </UCard>
        </div>
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
import type { StudyItem, WatchPage } from '~/composables/useLearn'
import type VideoPlayer from '~/components/VideoPlayer.vue'

const route = useRoute()
const { watch: getWatchPage, cues: getCues, study } = useLearn()
const { setCompleted, forVideos } = useWatchProgress()
const toast = useToast()
const tracker = useProgressTracker()

const id = computed(() => Number(route.params.id))
const page = ref<WatchPage | null>(null)
const studyItems = ref<StudyItem[]>([])
const loading = ref(true)
const error = ref('')
const hasQuiz = computed(() => studyItems.value.some((i) => i.type === 'QUIZ'))

// ── Course context (breadcrumb, prev/next, and what "ended" offers next) ───
const { course, prevItem, nextItem, linkTo } = useVideoCourse(computed(() => page.value?.video.id ?? null))

// ── Player ─────────────────────────────────────────────────────────────────
// Typed explicitly: the template reads values derived from it, which would otherwise make its type circular.
const player = useTemplateRef<InstanceType<typeof VideoPlayer>>('player')
const currentMs = ref(0)
const isPlaying = computed(() => !!player.value?.playing)
const canControl = computed(() => !!player.value?.canControl)
function onTime(ms: number) {
  currentMs.value = ms
  tracker.onTime(ms)
  if (stopAtMs !== null && ms >= stopAtMs) {
    stopAtMs = null
    player.value?.pause()
    restoreSpeed()
    return
  }
  followLines(ms)
}

// ── Practice: play one line (optionally slower), then stop ─────────────────
let stopAtMs: number | null = null
let speedBefore: number | null = null
function restoreSpeed() {
  if (speedBefore !== null) {
    player.value?.setRate(speedBefore)
    speedBefore = null
  }
}
function playLine(range: { startMs: number; endMs: number; slow: boolean }) {
  restoreSpeed()
  if (range.slow) {
    speedBefore = speed.value
    player.value?.setRate(0.75)
  }
  seek(range.startMs)
  stopAtMs = range.endMs
}
function seek(ms: number, play = true) {
  // Follow the line we land on — not the one we left, whose end we may be sitting on.
  pausedLine = null
  // Any seek ends a practice line's "stop at its end" (playLine sets it again right after).
  stopAtMs = null
  followed = lineAt(primaryCues.value, ms)
  finished.value = false
  player.value?.seek(ms, play)
  currentMs.value = ms
}

// ── Ended: what to do next, instead of leaving the learner sitting there ───
const finished = ref(false)
function onEnded() {
  finished.value = true
  tracker.onEnded()
  checkCourseFinished()
}

// Whether ending this video (the last unwatched one) finishes the whole
// course — checked against every other video's saved progress, since this
// page only tracks the one currently playing.
const courseFinished = ref(false)
async function checkCourseFinished() {
  courseFinished.value = false
  if (!course.value || nextItem.value) return
  const others = course.value.videos.filter((v) => v.videoId !== page.value?.video.id)
  if (!others.length) {
    courseFinished.value = true
    return
  }
  try {
    const map = await forVideos(others.map((v) => v.videoId))
    courseFinished.value = others.every((v) => map.get(v.videoId)?.completed)
  } catch {
    courseFinished.value = false
  }
}
function watchAgain() {
  seek(0)
}
const studyPanelEl = ref<HTMLElement | null>(null)
function goToQuiz() {
  finished.value = false
  nextTick(() => studyPanelEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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

// ── Auto-hide controls in full screen ───────────────────────────────────────
// Outside full screen the bar always stays put — it's not competing with
// anything else for space. In full screen it behaves like any video player:
// fades out after a moment of no movement while playing, and comes back on
// the slightest hint someone's still there.
const AUTO_HIDE_MS = 2500
const controlsHidden = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | undefined
function scheduleHide() {
  clearTimeout(hideTimer)
  if (!isFullscreen.value) return
  hideTimer = setTimeout(() => {
    if (isFullscreen.value && isPlaying.value) controlsHidden.value = true
  }, AUTO_HIDE_MS)
}
function pauseAutoHide() {
  clearTimeout(hideTimer)
}
function wakeControls() {
  controlsHidden.value = false
  scheduleHide()
}
watch(isFullscreen, (fs) => {
  if (fs) wakeControls()
  else {
    controlsHidden.value = false
    clearTimeout(hideTimer)
  }
})
watch(isPlaying, () => wakeControls())

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
  { keys: 'S', label: 'Next subtitle track' },
  { keys: 'T', label: 'Second language on / off' },
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
  s: () => cycleTrack(),
  t: () => toggleSecond(),
  f: () => toggleFullscreen(),
  '[': () => stepSpeed(-1),
  ']': () => stepSpeed(1)
})

// ── Subtitles ──────────────────────────────────────────────────────────────
// Tracks follow the learner's remembered languages; cues carry their timing
// correction for this video (see useCaptions).
const {
  prefs,
  trackId,
  secondId,
  primaryTrack,
  secondTrack,
  trackOptions,
  secondOptions,
  primaryCues,
  secondaryCues,
  offsetMs,
  OFFSET_STEP,
  nudge,
  resetOffset,
  cycleTrack,
  toggleSecond,
  glossaryTerms
} = useCaptions({
  videoId: computed(() => page.value?.video.id ?? null),
  videoLanguage: computed(() => page.value?.video.language ?? null),
  tracks: computed(() => page.value?.tracks ?? [])
})
const showCaptions = ref(true)
// Declared here: the hover-pause watcher below reads it straight away.
const lookupOpen = ref(false)

// Pointing at the captions pauses (if the learner wants that), so a word can
// be clicked calmly; moving away resumes — unless a lookup is open.
let pausedByHover = false
function onCaptionHover(inside: boolean) {
  if (!prefs.value.hoverPause) return
  if (inside && isPlaying.value) {
    pausedByHover = true
    player.value?.pause()
  } else if (!inside && pausedByHover && !lookupOpen.value) {
    pausedByHover = false
    player.value?.play()
  }
}
watch(
  () => lookupOpen.value,
  (open) => {
    if (!open && pausedByHover) {
      pausedByHover = false
      player.value?.play()
    }
  }
)

// ── Voice-over ─────────────────────────────────────────────────────────────
// '' = the original sound.
const voiceOver = ref('')
const voiceOptions = computed(() => [
  { label: 'Original sound', value: '' },
  ...(page.value?.voiceOvers ?? []).map((d) => ({ label: `${d.languageName} voice-over`, value: d.audioUrl }))
])

// ── Word lookup ────────────────────────────────────────────────────────────
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
  finished.value = false
  courseFinished.value = false
  try {
    page.value = await getWatchPage(id.value)
    const t = Number(route.query.t)
    tracker.start(page.value.video.id, page.value.video.durationSeconds, Number.isFinite(t) && t > 0 ? t / 1000 : null)
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
