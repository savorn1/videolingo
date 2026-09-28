<template>
  <div class="space-y-3">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
    <template v-else>
      <div class="rounded-lg overflow-hidden bg-black max-w-2xl">
        <VideoPlayer
          ref="player"
          :video-url="video.videoUrl"
          :poster="video.thumbnailUrl"
          :dub-url="selectedDub?.audioUrl ?? null"
          read-duration
          @time="onTime"
          @duration="onDuration"
        />
      </div>

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <UTooltip text="Zoom out"
          ><UButton size="sm" color="neutral" variant="soft" icon="i-lucide-zoom-out" aria-label="Zoom out" @click="zoomOut"
        /></UTooltip>
        <span class="text-xs text-gray-500 w-20 text-center tabular-nums">{{ Math.round(pxPerSec) }} px/s</span>
        <UTooltip text="Zoom in"><UButton size="sm" color="neutral" variant="soft" icon="i-lucide-zoom-in" aria-label="Zoom in" @click="zoomIn" /></UTooltip>
        <span class="text-sm font-medium tabular-nums text-gray-900 dark:text-white ml-2">
          {{ formatTimestamp(playheadMs) }} <span class="text-gray-400">/ {{ formatTimestamp(durationMs) }}</span>
        </span>
        <USelect v-model="selectedAudio" :items="audioOptions" size="sm" class="w-52 ml-auto" aria-label="Preview audio" />
      </div>

      <!-- Timeline: a fixed label column (outside the scroll area) beside a
           scrollable body — the ruler, playhead, markers and every track's
           bar all live in that same scrollable body so they share one x=0
           origin. (Putting per-row labels inside the scrolling content, as a
           sticky column, looked right but actually offset every bar/tick by
           the label width — this two-column split is what keeps them aligned.) -->
      <div class="flex rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="w-44 shrink-0 border-r border-gray-200 dark:border-gray-800">
          <div class="h-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60" />
          <div class="h-10 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1.5 px-2">
            <UIcon name="i-lucide-film" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-xs font-medium truncate flex-1">Video</span>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="videoMuted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              :aria-label="videoMuted ? 'Unmute' : 'Mute'"
              @click="toggleVideoMute"
            />
          </div>
          <div
            v-for="dub in dubs"
            :key="dub.id"
            v-show="!hidden.has(`dub-${dub.id}`)"
            class="h-10 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1 px-2"
          >
            <UIcon name="i-lucide-mic" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-xs font-medium truncate flex-1" :title="`${dub.languageName} · ${dub.voiceName}`">{{ dub.languageName }}</span>
            <UButton
              v-if="canWrite"
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="dub.locked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
              :aria-label="dub.locked ? 'Unlock' : 'Lock'"
              @click="toggleDubLock(dub)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="muted.has(`dub-${dub.id}`) ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
              :aria-label="muted.has(`dub-${dub.id}`) ? 'Unmute' : 'Mute'"
              @click="toggleMuted(`dub-${dub.id}`)"
            />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-eye-off" aria-label="Hide track" @click="toggleHidden(`dub-${dub.id}`)" />
          </div>
          <div
            v-for="t in subtitleTracks"
            :key="t.id"
            v-show="!hidden.has(`sub-${t.id}`)"
            class="h-10 border-b border-gray-100 dark:border-gray-800 flex items-center gap-1 px-2"
          >
            <UIcon name="i-lucide-captions" class="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span class="text-xs font-medium truncate flex-1" :title="t.label">{{ t.label }}</span>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-eye-off" aria-label="Hide track" @click="toggleHidden(`sub-${t.id}`)" />
          </div>
        </div>

        <div ref="scrollEl" class="overflow-x-auto flex-1" @wheel="onWheel">
          <div :style="{ width: `${totalWidthPx}px`, minWidth: '100%' }" class="relative select-none">
            <!-- Ruler + markers -->
            <div
              ref="rulerEl"
              data-testid="timeline-ruler"
              class="relative h-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 cursor-pointer"
              @pointerdown="onRulerPointerDown"
              @dblclick="onRulerDblClick"
            >
              <div
                v-for="tick in ticks"
                :key="tick.ms"
                class="absolute top-0 bottom-0 border-l border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 pl-1 pt-0.5 pointer-events-none"
                :style="{ left: `${tick.px}px` }"
              >
                {{ tick.label }}
              </div>
              <button
                v-for="m in markers"
                :key="m.id"
                type="button"
                class="group absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-auto"
                :style="{ left: `${msToPx(m.atMs, pxPerSec)}px` }"
                :title="m.label"
                @pointerdown.stop="onMarkerPointerDown(m, $event)"
                @click.stop="seekTo(m.atMs)"
              >
                <UIcon name="i-lucide-flag" class="w-3.5 h-3.5 text-warning-500 group-hover:text-warning-600" />
                <span
                  class="absolute top-4 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {{ m.label }}
                  <button v-if="canWrite" type="button" class="ml-1 text-white/70 hover:text-white" @click.stop="onDeleteMarker(m)">✕</button>
                </span>
              </button>
            </div>

            <!-- Playhead -->
            <div class="absolute top-0 bottom-0 w-px bg-error-500 pointer-events-none z-10" :style="{ left: `${msToPx(playheadMs, pxPerSec)}px` }" />

            <!-- Video track -->
            <div class="relative h-10 border-b border-gray-100 dark:border-gray-800 bg-primary-100 dark:bg-primary-950/40" />

            <!-- Voice-over tracks -->
            <div v-for="dub in dubs" :key="dub.id" v-show="!hidden.has(`dub-${dub.id}`)" class="relative h-10 border-b border-gray-100 dark:border-gray-800">
              <div
                class="absolute inset-y-1 rounded bg-info-200 dark:bg-info-950/50"
                :style="{ left: 0, width: `${msToPx(dub.durationMs, pxPerSec)}px` }"
                :class="muted.has(`dub-${dub.id}`) ? 'opacity-40' : ''"
              />
            </div>

            <!-- Subtitle tracks -->
            <div
              v-for="t in subtitleTracks"
              :key="t.id"
              v-show="!hidden.has(`sub-${t.id}`)"
              class="relative h-10 border-b border-gray-100 dark:border-gray-800"
            >
              <div
                v-for="(cue, i) in t.cues ?? []"
                :key="i"
                class="absolute inset-y-1.5 rounded-sm bg-success-200 dark:bg-success-950/50"
                :style="{ left: `${msToPx(cue.startMs, pxPerSec)}px`, width: `${Math.max(2, msToPx(cue.endMs - cue.startMs, pxPerSec))}px` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Add a voice-over track -->
      <div v-if="canWrite" class="flex flex-wrap items-end gap-2">
        <UFormField label="Add voice-over" class="w-40">
          <USelect v-model="newDubLanguage" :items="languageOptions" size="sm" class="w-full" />
        </UFormField>
        <UFormField label="Voice" class="w-40">
          <USelect v-model="newDubVoice" :items="voiceOptions" size="sm" class="w-full" />
        </UFormField>
        <UButton size="sm" icon="i-lucide-plus" :loading="creatingDub" :disabled="!newDubLanguage" @click="onCreateDub">Add track</UButton>
      </div>
    </template>

    <UModal v-model:open="showMarkerForm" title="Add marker" :ui="{ content: 'sm:max-w-sm' }">
      <template #body>
        <form class="space-y-3" @submit.prevent="onCreateMarker">
          <UFormField label="Label">
            <UInput v-model="newMarkerLabel" autofocus maxlength="200" class="w-full" placeholder="e.g. Intro ends" />
          </UFormField>
          <p class="text-xs text-gray-500">At {{ formatTimestamp(pendingMarkerMs) }}</p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showMarkerForm = false">Cancel</UButton>
            <UButton type="submit" :loading="creatingMarker" :disabled="!newMarkerLabel.trim()">Add</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// A multi-track timeline: the video, its voice-over tracks (VideoDub) and
// subtitle tracks (read-only, shown for reference and as snap targets), a
// zoomable ruler with a playhead, and markers. Tracks reuse existing data —
// there's no separate clip/composition model, just a view onto what the
// video already has (see the plan this was built from).
import type { Video } from '~/composables/useVideos'
import type { VideoDub } from '~/composables/useDubs'
import type { Subtitle } from '~/composables/useSubtitles'
import type { VideoMarker } from '~/composables/useVideoMarkers'
import type VideoPlayer from '~/components/VideoPlayer.vue'
import { clampZoom, cueSnapTargets, msToPx, pxToMs, snapMs, ZOOM_STEP } from '#shared/utils/timeline'

const props = defineProps<{ video: Video; canWrite: boolean }>()

const toast = useToast()
const { overview: dubOverview, create: createDub, setLocked } = useDubs()
const { list: listSubtitles, get: getSubtitle } = useSubtitles()
const { list: listMarkers, create: createMarkerApi, update: updateMarkerApi, remove: removeMarkerApi } = useVideoMarkers()

const error = ref('')
const dubs = ref<VideoDub[]>([])
const subtitleTracks = ref<Subtitle[]>([])
const markers = ref<VideoMarker[]>([])
const voices = ref<Record<string, { id: string; name: string; gender: string }[]>>({})

async function load() {
  error.value = ''
  try {
    const [dubData, tracks, markerData] = await Promise.all([
      dubOverview(props.video.id),
      listSubtitles({ videoId: props.video.id, size: 100 }),
      listMarkers(props.video.id)
    ])
    dubs.value = dubData.dubs
    voices.value = dubData.voices
    markers.value = markerData
    subtitleTracks.value = await Promise.all(tracks.data.map((t) => getSubtitle(t.id)))
  } catch (err) {
    error.value = apiErrorMessage(err)
  }
}
onMounted(load)
watch(() => props.video.id, load)

// ── Player ────────────────────────────────────────────────────────────────
const player = useTemplateRef<InstanceType<typeof VideoPlayer>>('player')
const playheadMs = ref(0)
const durationMs = ref((props.video.durationSeconds ?? 0) * 1000)
function onTime(ms: number) {
  playheadMs.value = ms
}
function onDuration(seconds: number) {
  durationMs.value = seconds * 1000
}
function seekTo(ms: number) {
  playheadMs.value = ms
  player.value?.seek(ms, false)
}

const videoMuted = ref(false)
function toggleVideoMute() {
  videoMuted.value = !videoMuted.value
  if (player.value?.videoEl) player.value.videoEl.muted = videoMuted.value
}

// ── Preview audio (original or a voice-over) ────────────────────────────────
const ORIGINAL = 'original'
const selectedAudio = ref(ORIGINAL)
const selectedDub = computed(() => dubs.value.find((d) => d.id.toString() === selectedAudio.value))
const audioOptions = computed(() => [
  { label: 'Original sound', value: ORIGINAL },
  ...dubs.value.map((d) => ({ label: `${d.languageName} · ${d.voiceName}`, value: d.id.toString() }))
])

// ── Zoom ─────────────────────────────────────────────────────────────────────
const pxPerSec = ref(60)
function zoomIn() {
  pxPerSec.value = clampZoom(pxPerSec.value * ZOOM_STEP)
}
function zoomOut() {
  pxPerSec.value = clampZoom(pxPerSec.value / ZOOM_STEP)
}
// Ctrl/Cmd + wheel zooms, like a real timeline — a plain wheel just scrolls.
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}
const totalWidthPx = computed(() => Math.max(600, msToPx(durationMs.value, pxPerSec.value) + 40))

// Nice round tick intervals so labels don't crowd at any zoom level.
const TICK_STEPS_SEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900]
const ticks = computed(() => {
  const stepSec = TICK_STEPS_SEC.find((s) => s * pxPerSec.value >= 70) ?? TICK_STEPS_SEC[TICK_STEPS_SEC.length - 1]!
  const out: { ms: number; px: number; label: string }[] = []
  for (let s = 0; s * 1000 <= durationMs.value + stepSec * 1000; s += stepSec) {
    out.push({ ms: s * 1000, px: msToPx(s * 1000, pxPerSec.value), label: formatTimestamp(s * 1000) })
  }
  return out
})

// ── Snapping ─────────────────────────────────────────────────────────────────
const snapTargets = computed(() => {
  const cueTargets = subtitleTracks.value.filter((t) => !hidden.has(`sub-${t.id}`)).flatMap((t) => cueSnapTargets(t.cues ?? []))
  const markerTargets = markers.value.map((m) => m.atMs)
  return [...cueTargets, ...markerTargets]
})
function snapped(candidateMs: number) {
  const toleranceMs = pxToMs(8, pxPerSec.value)
  const wholeSecond = Math.round(candidateMs / 1000) * 1000
  return snapMs(candidateMs, [...snapTargets.value, wholeSecond], toleranceMs)
}

// ── Ruler: click/drag the playhead, double-click to add a marker ───────────
const scrollEl = useTemplateRef<HTMLDivElement>('scrollEl')
const rulerEl = useTemplateRef<HTMLDivElement>('rulerEl')
function msAtClientX(clientX: number): number {
  const rect = rulerEl.value!.getBoundingClientRect()
  const px = clientX - rect.left
  return Math.max(0, Math.min(durationMs.value, pxToMs(px, pxPerSec.value)))
}
let draggingPlayhead = false
function onRulerPointerDown(e: PointerEvent) {
  draggingPlayhead = true
  seekTo(snapped(msAtClientX(e.clientX)))
  window.addEventListener('pointermove', onRulerPointerMove)
  window.addEventListener('pointerup', onRulerPointerUp, { once: true })
}
function onRulerPointerMove(e: PointerEvent) {
  if (!draggingPlayhead) return
  seekTo(snapped(msAtClientX(e.clientX)))
}
function onRulerPointerUp() {
  draggingPlayhead = false
  window.removeEventListener('pointermove', onRulerPointerMove)
}

const showMarkerForm = ref(false)
const pendingMarkerMs = ref(0)
const newMarkerLabel = ref('')
function onRulerDblClick(e: MouseEvent) {
  if (!props.canWrite) return
  pendingMarkerMs.value = snapped(msAtClientX(e.clientX))
  newMarkerLabel.value = ''
  showMarkerForm.value = true
}
const creatingMarker = ref(false)
async function onCreateMarker() {
  if (!newMarkerLabel.value.trim()) return
  creatingMarker.value = true
  try {
    const marker = await createMarkerApi(props.video.id, { atMs: pendingMarkerMs.value, label: newMarkerLabel.value.trim() })
    markers.value = [...markers.value, marker].sort((a, b) => a.atMs - b.atMs)
    showMarkerForm.value = false
  } catch (err) {
    toast.add({ title: 'Could not add the marker', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creatingMarker.value = false
  }
}
async function onDeleteMarker(m: VideoMarker) {
  try {
    await removeMarkerApi(props.video.id, m.id)
    markers.value = markers.value.filter((x) => x.id !== m.id)
  } catch (err) {
    toast.add({ title: 'Could not delete the marker', description: apiErrorMessage(err), color: 'error' })
  }
}

let draggingMarker: VideoMarker | null = null
function onMarkerPointerDown(m: VideoMarker, e: PointerEvent) {
  if (!props.canWrite) return
  draggingMarker = m
  window.addEventListener('pointermove', onMarkerPointerMove)
  window.addEventListener('pointerup', onMarkerPointerUp, { once: true })
  e.preventDefault()
}
function onMarkerPointerMove(e: PointerEvent) {
  if (!draggingMarker) return
  const ms = snapped(msAtClientX(e.clientX))
  markers.value = markers.value.map((x) => (x.id === draggingMarker!.id ? { ...x, atMs: ms } : x))
}
async function onMarkerPointerUp() {
  window.removeEventListener('pointermove', onMarkerPointerMove)
  const m = draggingMarker
  draggingMarker = null
  if (!m) return
  const moved = markers.value.find((x) => x.id === m.id)
  if (!moved || moved.atMs === m.atMs) return
  try {
    await updateMarkerApi(props.video.id, m.id, { atMs: moved.atMs, label: moved.label })
    markers.value = [...markers.value].sort((a, b) => a.atMs - b.atMs)
  } catch (err) {
    toast.add({ title: 'Could not move the marker', description: apiErrorMessage(err), color: 'error' })
    await load()
  }
}

// ── Hide / mute (local editor state only — see the plan) ───────────────────
const hidden = reactive(new Set<string>())
const muted = reactive(new Set<string>())
function toggleHidden(key: string) {
  if (hidden.has(key)) hidden.delete(key)
  else hidden.add(key)
}
function toggleMuted(key: string) {
  if (muted.has(key)) muted.delete(key)
  else muted.add(key)
}

// ── Lock a voice-over track ──────────────────────────────────────────────────
async function toggleDubLock(dub: VideoDub) {
  try {
    const updated = await setLocked(props.video.id, dub.id, !dub.locked)
    dubs.value = dubs.value.map((d) => (d.id === dub.id ? updated : d))
  } catch (err) {
    toast.add({ title: 'Could not update the track', description: apiErrorMessage(err), color: 'error' })
  }
}

// ── Add a voice-over track ───────────────────────────────────────────────────
const newDubLanguage = ref('')
const newDubVoice = ref('')
const languageOptions = computed(() => Object.keys(voices.value).map((code) => ({ label: languageLabel(code), value: code })))
const voiceOptions = computed(() => (voices.value[newDubLanguage.value] ?? []).map((v) => ({ label: `${v.name} (${v.gender.toLowerCase()})`, value: v.id })))
watch(languageOptions, (opts) => {
  if (!newDubLanguage.value && opts.length) newDubLanguage.value = opts[0]!.value
})
watch(voiceOptions, (opts) => {
  if (!opts.some((o) => o.value === newDubVoice.value)) newDubVoice.value = opts[0]?.value ?? ''
})
const creatingDub = ref(false)
async function onCreateDub() {
  if (!newDubLanguage.value) return
  creatingDub.value = true
  try {
    const job = await createDub(props.video.id, { language: newDubLanguage.value, voice: newDubVoice.value || undefined })
    toast.add({ title: `Voice-over queued — job #${job.id}`, description: 'It appears here once it finishes.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not start the voice-over', description: apiErrorMessage(err), color: 'error' })
  } finally {
    creatingDub.value = false
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onRulerPointerMove)
  window.removeEventListener('pointermove', onMarkerPointerMove)
})
</script>
