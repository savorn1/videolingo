<template>
  <div
    class="relative bg-black overflow-hidden flex items-center justify-center"
    :class="fill ? 'w-full h-full' : vertical ? 'rounded-lg aspect-[9/16] h-[min(70vh,720px)] max-w-full mx-auto' : 'rounded-lg w-full aspect-video'"
  >
    <template v-if="embedUrl">
      <!-- Click-to-play cover: the platform's player (~1 MB of scripts) only loads once asked for. -->
      <button
        v-if="!activated"
        type="button"
        class="group absolute inset-0 w-full h-full cursor-pointer"
        :aria-label="`Play ${title ?? 'video'}`"
        @click="activate()"
      >
        <img v-if="coverImage" :src="coverImage" alt="" class="w-full h-full object-cover" />
        <span class="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/25 transition-colors">
          <span class="flex items-center justify-center w-16 h-16 rounded-full bg-black/60 group-hover:bg-primary-600 transition-colors">
            <UIcon name="i-lucide-play" class="w-8 h-8 text-white ml-1" />
          </span>
        </span>
      </button>
      <iframe
        v-else
        ref="frame"
        :key="frameSrc"
        :src="frameSrc"
        class="w-full h-full"
        :title="title ?? 'Video player'"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </template>
    <template v-else-if="!playbackError">
      <video
        ref="videoEl"
        :key="videoUrl ?? ''"
        :src="videoUrl ?? undefined"
        :poster="poster ?? undefined"
        controls
        :controlslist="ownFullscreen ? 'nofullscreen' : undefined"
        preload="metadata"
        class="w-full h-full"
        @error="playbackError = true"
        @loadedmetadata="onVideoMetadata"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @seeked="reportTime(videoEl?.currentTime ?? 0)"
        @ended="onEnded"
        @ratechange="syncDubRate"
        @webkitbeginfullscreen="setNativeTrack(true)"
        @webkitendfullscreen="setNativeTrack(false)"
      >
        <!-- Only shown when the browser takes the video itself full screen (Safari / iPhone
             always do): our own captions can't follow it there. Hidden otherwise. -->
        <track v-if="trackUrl" :key="trackUrl" kind="subtitles" :src="trackUrl" :srclang="trackLanguage ?? undefined" label="Subtitles" />
      </video>
    </template>

    <!-- Captions drawn by the page (it knows the cues); a second language sits on top. -->
    <div v-if="captionSecondary" class="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-6">
      <span
        class="rounded bg-black/60 px-2 py-0.5 text-center text-yellow-200 whitespace-pre-line leading-snug"
        :class="fill ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'"
        >{{ captionSecondary }}</span
      >
    </div>
    <div v-if="caption" class="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-6" :class="fill ? 'bottom-20' : 'bottom-14'">
      <span
        class="rounded bg-black/75 px-2 py-0.5 text-center text-white font-semibold whitespace-pre-line leading-snug"
        :class="fill ? 'text-2xl sm:text-4xl' : 'text-base sm:text-lg'"
        >{{ caption }}</span
      >
    </div>

    <!-- Voice-over track, played in place of the video's own sound. -->
    <audio v-if="dubUrl" ref="dubEl" :key="dubUrl" :src="dubUrl" preload="auto" class="hidden" />
    <button
      v-if="dubUrl && dubBlocked"
      type="button"
      class="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-600"
      @click="resumeDub"
    >
      <UIcon name="i-lucide-volume-2" class="w-4 h-4" />
      Turn on the voice-over
    </button>

    <div
      v-if="playbackError || embedError"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white/80 bg-black"
      role="alert"
    >
      <UIcon name="i-lucide-circle-alert" class="w-8 h-8" />
      <p class="font-semibold">This video can't be played here</p>
      <p class="text-sm text-white/60 max-w-sm">{{ embedError ?? "The file may be missing, or its format isn't supported by this browser." }}</p>
      <UButton v-if="videoUrl" size="xs" color="neutral" variant="soft" :to="videoUrl" target="_blank" icon="i-lucide-external-link" class="mt-2">
        {{ embedError ? 'Open on YouTube' : 'Open file URL' }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// Plays a video the way its source needs: a platform's embed player
// (YouTube, Vimeo, Facebook) or the file itself.
//
// - Reports the playback position (`time`, in ms) and takes `seek()` for
//   files, YouTube and Vimeo — `canSync` says whether that works for the
//   current source (Facebook has no player API).
// - Embeds start as a click-to-play cover, except with `readDuration`, where
//   the player has to load straight away to report the length.
// - With `resumeKey`, remembers the position in this browser and picks up
//   from there next time.
// - With `dubUrl`, plays that voice-over track in sync with the video and
//   mutes the video's own sound (files, YouTube and Vimeo).
// - With `autoplay`, starts on its own (no cover) — for playlists. Emits
//   `ended` when the video finishes (files, YouTube and Vimeo; Facebook's
//   player doesn't say).
const props = defineProps<{
  embedUrl?: string | null
  /** The file to play — or, for embeds, the original link (offered when the embed fails). */
  videoUrl?: string | null
  poster?: string | null
  title?: string | null
  /** 9:16 content (Shorts, Reels, portrait files). */
  vertical?: boolean
  readDuration?: boolean
  resumeKey?: string | number | null
  /** Voice-over audio to play instead of the original sound. */
  dubUrl?: string | null
  /** Start playing as soon as it loads (browsers may still ask for a click the first time). */
  autoplay?: boolean
  /** Where to resume, e.g. from the user's saved progress on the server; wins over `resumeKey`'s local copy. */
  startAt?: number | null
  /** Subtitle line to show over the picture (and a second-language line above it). */
  caption?: string | null
  captionSecondary?: string | null
  /** The page provides its own full-screen button: hide the video's / YouTube's, which would leave captions behind. */
  ownFullscreen?: boolean
  /** Fill the parent instead of keeping 16:9 (e.g. while the page is full screen). */
  fill?: boolean
  /** Cues for the browser's own subtitle display, used only in native full screen (files). */
  trackCues?: { startMs: number; endMs: number; text: string }[] | null
  trackSecondary?: { startMs: number; endMs: number; text: string }[] | null
  trackLanguage?: string | null
}>()
const emit = defineEmits<{ duration: [seconds: number]; time: [ms: number]; ended: [] }>()

const frame = ref<HTMLIFrameElement | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)
const playbackError = ref(false)
const embedError = ref<string | null>(null)

const isYouTube = computed(() => isYouTubeEmbed(props.embedUrl))
const isVimeo = computed(() => isVimeoEmbed(props.embedUrl))
const canSync = computed(() => (props.embedUrl ? isYouTube.value || isVimeo.value : !!props.videoUrl))

// The cover waits for a click; readDuration needs the player loaded right away.
const clicked = ref(false)
const activated = computed(() => props.readDuration || props.autoplay || clicked.value)
const coverImage = computed(() => props.poster || youTubeThumbnail(props.embedUrl))

// Only built on the client: the YouTube API needs the page's origin.
const frameSrc = computed(() => {
  if (!props.embedUrl) return ''
  if (!import.meta.client) return props.embedUrl
  return playerEmbedUrl(props.embedUrl, { origin: window.location.origin, autoplay: clicked.value || !!props.autoplay, fullscreenButton: !props.ownFullscreen })
})

// A position to jump to once the player is ready (a seek before it loaded).
let pendingSeek: number | null = null

watch(
  () => [props.embedUrl, props.videoUrl],
  () => {
    playbackError.value = false
    embedError.value = null
    clicked.value = false
    pendingSeek = null
  }
)

function activate(seconds?: number) {
  if (seconds !== undefined) pendingSeek = seconds
  clicked.value = true
}

// ── Remembered position ────────────────────────────────────────────────────
const storageKey = computed(() => (props.resumeKey != null && props.resumeKey !== '' ? `videolingo:resume:${props.resumeKey}` : null))
let lastSaved = 0

function savedPosition(): number | null {
  if (!storageKey.value) return null
  try {
    return Number(localStorage.getItem(storageKey.value)) || null
  } catch {
    return null
  }
}
function savePosition(seconds: number, force = false) {
  if (!storageKey.value || (!force && Math.abs(seconds - lastSaved) < 5)) return
  lastSaved = seconds
  try {
    localStorage.setItem(storageKey.value, String(Math.floor(seconds)))
  } catch {
    // Private windows can refuse storage; resuming is only a convenience.
  }
}
function clearPosition() {
  if (!storageKey.value) return
  try {
    localStorage.removeItem(storageKey.value)
  } catch {
    // See savePosition.
  }
}

/** Where to start once the player is ready: a requested seek, else the saved spot. */
function startPosition(durationSeconds?: number | null): number | null {
  const seek = pendingSeek
  pendingSeek = null
  return seek ?? resumePosition(props.startAt ?? savedPosition(), durationSeconds)
}

function reportTime(seconds: number) {
  emit('time', Math.round(seconds * 1000))
  savePosition(seconds)
  syncDubTime(seconds)
}

function onEnded() {
  stopClock()
  clearPosition()
  setPlaying(false)
  emit('ended')
}

// ── Clock ──────────────────────────────────────────────────────────────────
// timeupdate fires only ~4×/s, too coarse for subtitle timing, so while
// playing a requestAnimationFrame loop reads the position every frame.
let clockFrame = 0
let readTime: (() => number | undefined) | null = null

function startClock() {
  cancelAnimationFrame(clockFrame)
  const tick = () => {
    const t = readTime ? readTime() : videoEl.value?.currentTime
    if (t !== undefined) reportTime(t)
    clockFrame = requestAnimationFrame(tick)
  }
  clockFrame = requestAnimationFrame(tick)
}
function stopClock() {
  cancelAnimationFrame(clockFrame)
}

// ── File playback ──────────────────────────────────────────────────────────
function onVideoMetadata() {
  const el = videoEl.value
  if (!el) return
  const d = el.duration
  if (props.readDuration && d && Number.isFinite(d)) emit('duration', Math.round(d))
  const start = startPosition(Number.isFinite(d) ? d : null)
  if (start !== null) {
    el.currentTime = start
    reportTime(start)
  }
  if (props.autoplay) el.play().catch(() => {})
}
function onVideoPlay() {
  startClock()
  setPlaying(true)
}
function onVideoPause() {
  stopClock()
  setPlaying(false)
  if (videoEl.value) savePosition(videoEl.value.currentTime, true)
}

// ── Platform players (YouTube / Vimeo) ─────────────────────────────────────
function loadScript(src: string, globalName: string): Promise<void> {
  const w = window as unknown as Record<string, unknown>
  if (w[globalName]) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(`Couldn't load ${src}`)), { once: true })
    if (!existing) {
      script.src = src
      script.async = true
      document.head.appendChild(script)
    }
  })
}

interface YTPlayer {
  getDuration(): number
  getCurrentTime(): number
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  setPlaybackRate(rate: number): void
  mute(): void
  unMute(): void
}
interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: {
      events: {
        onReady: (e: { target: YTPlayer }) => void
        onStateChange: (e: { data: number; target: YTPlayer }) => void
        onError: (e: { data: number }) => void
      }
    }
  ) => YTPlayer
}
interface VimeoPlayer {
  ready(): Promise<void>
  getDuration(): Promise<number>
  setCurrentTime(seconds: number): Promise<number>
  play(): Promise<void>
  pause(): Promise<void>
  setPlaybackRate(rate: number): Promise<number>
  on(event: 'timeupdate', cb: (e: { seconds: number }) => void): void
  on(event: 'play' | 'pause' | 'ended', cb: (e: { seconds: number }) => void): void
  off(event: string): void
  setVolume(volume: number): Promise<number>
}

// YT player states (YT.PlayerState).
const YT_ENDED = 0
const YT_PLAYING = 1
const YT_PAUSED = 2

let ytPlayer: YTPlayer | null = null
let vimeoPlayer: VimeoPlayer | null = null
/** Bumped on every (dis)connect so callbacks from an old iframe are ignored. */
let connection = 0

async function loadYouTubeApi() {
  const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void }
  if (w.YT?.Player) return w.YT
  await new Promise<void>((resolve, reject) => {
    const previous = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve()
    }
    // The API announces itself through onYouTubeIframeAPIReady, not a global
    // that exists on load, hence the name loadScript never finds.
    loadScript('https://www.youtube.com/iframe_api', '__yt_never__').catch(reject)
  })
  return w.YT!
}

// Drops the current player connection. The iframe itself is Vue's, so the
// platform's destroy() (which removes it) isn't used.
function disconnect() {
  connection++
  stopClock()
  readTime = null
  ytPlayer = null
  setPlaying(false)
  if (vimeoPlayer) {
    vimeoPlayer.off('timeupdate')
    vimeoPlayer.off('play')
    vimeoPlayer.off('pause')
    vimeoPlayer.off('ended')
    vimeoPlayer = null
  }
}

async function connect() {
  disconnect()
  const el = frame.value
  if (!el || !(isYouTube.value || isVimeo.value)) return
  const id = connection
  try {
    if (isYouTube.value) {
      const YT = await loadYouTubeApi()
      if (id !== connection) return
      new YT.Player(el, {
        events: {
          onReady: ({ target }) => {
            if (id !== connection) return
            ytPlayer = target
            readTime = () => ytPlayer?.getCurrentTime()
            applyOriginalMute()
            if (rate.value !== 1) target.setPlaybackRate(rate.value)
            const d = target.getDuration()
            if (props.readDuration && d > 0) emit('duration', Math.round(d))
            const start = startPosition(d)
            if (start !== null) {
              target.seekTo(start, true)
              reportTime(start)
            }
          },
          onStateChange: ({ data, target }) => {
            if (id !== connection) return
            setPlaying(data === YT_PLAYING)
            if (data === YT_PLAYING) startClock()
            else {
              stopClock()
              if (data === YT_PAUSED) savePosition(target.getCurrentTime(), true)
              if (data === YT_ENDED) {
                clearPosition()
                emit('ended')
              }
            }
          },
          onError: ({ data }) => {
            if (id === connection) embedError.value = youTubeErrorMessage(data)
          }
        }
      })
    } else {
      await loadScript('https://player.vimeo.com/api/player.js', 'Vimeo')
      if (id !== connection) return
      const Vimeo = (window as unknown as { Vimeo: { Player: new (el: HTMLIFrameElement) => VimeoPlayer } }).Vimeo
      const player = new Vimeo.Player(el)
      await player.ready()
      if (id !== connection) return
      vimeoPlayer = player
      if (rate.value !== 1) player.setPlaybackRate(rate.value).catch(() => (rate.value = 1))
      // Vimeo reports the position ~4×/s itself; that's all its API offers.
      player.on('timeupdate', ({ seconds }) => reportTime(seconds))
      player.on('play', () => setPlaying(true))
      player.on('pause', ({ seconds }) => {
        setPlaying(false)
        savePosition(seconds, true)
      })
      player.on('ended', () => {
        setPlaying(false)
        clearPosition()
        emit('ended')
      })
      applyOriginalMute()
      const d = await player.getDuration()
      if (id !== connection) return
      if (props.readDuration && d > 0) emit('duration', Math.round(d))
      const start = startPosition(d)
      if (start !== null) {
        await player.setCurrentTime(start)
        reportTime(start)
      }
    }
  } catch {
    // The player APIs are a convenience; the video still plays without them.
  }
}

watch(frame, () => nextTick(connect), { flush: 'post' })
onBeforeUnmount(disconnect)

// ── Voice-over ─────────────────────────────────────────────────────────────
// The dub is a separate <audio> that follows the video: it plays and pauses
// with it, and is nudged back whenever it drifts more than a moment away.
const dubEl = ref<HTMLAudioElement | null>(null)
const dubBlocked = ref(false)
const playing = ref(false)
let lastTime = 0

function setPlaying(value: boolean) {
  playing.value = value
}

function syncDubTime(seconds: number) {
  lastTime = seconds
  const audio = dubEl.value
  if (!audio || !props.dubUrl) return
  if (Math.abs(audio.currentTime - seconds) > 0.3) audio.currentTime = seconds
}

function syncDubRate() {
  if (dubEl.value && videoEl.value) dubEl.value.playbackRate = videoEl.value.playbackRate
}

function playDub() {
  const audio = dubEl.value
  if (!audio) return
  audio.currentTime = lastTime
  audio
    .play()
    .then(() => (dubBlocked.value = false))
    // Browsers can refuse sound that wasn't started by a click on this page.
    .catch(() => (dubBlocked.value = true))
}

function resumeDub() {
  dubBlocked.value = false
  if (playing.value) playDub()
}

watch(playing, (isPlaying) => {
  if (!dubEl.value) return
  if (isPlaying) playDub()
  else dubEl.value.pause()
})

// The original sound is muted while a voice-over is chosen.
function applyOriginalMute() {
  const mute = !!props.dubUrl
  if (videoEl.value) videoEl.value.muted = mute
  if (ytPlayer) {
    if (mute) ytPlayer.mute()
    else ytPlayer.unMute()
  }
  vimeoPlayer?.setVolume(mute ? 0 : 1).catch(() => {})
}

watch(
  () => props.dubUrl,
  () => {
    dubBlocked.value = false
    applyOriginalMute()
    // The new <audio> mounts on the next render; pick up where the video is.
    nextTick(() => {
      syncDubRate()
      if (playing.value) playDub()
    })
  },
  { flush: 'post' }
)
watch(videoEl, () => applyOriginalMute(), { flush: 'post' })

/**
 * Jumps to `ms` — and plays, unless `play` is false (stepping while paused).
 * Loads the player first when it's still a cover.
 */
function seek(ms: number, play = true) {
  const seconds = ms / 1000
  if (props.embedUrl) {
    if (!activated.value) return activate(seconds)
    if (ytPlayer) {
      ytPlayer.seekTo(seconds, true)
      if (play) ytPlayer.playVideo()
    } else if (vimeoPlayer) {
      vimeoPlayer
        .setCurrentTime(seconds)
        .then(() => (play ? vimeoPlayer?.play() : undefined))
        .catch(() => {})
    } else {
      // Still connecting — onReady picks this up.
      pendingSeek = seconds
      return
    }
    reportTime(seconds)
    return
  }
  const el = videoEl.value
  if (!el) return
  el.currentTime = seconds
  if (play) el.play().catch(() => {})
  reportTime(seconds)
}

// ── Page-driven controls (sentence stepping, speed, shortcuts) ─────────────
/** Whether play/pause/speed can be driven from outside for this source. */
const canControl = computed(() => canSync.value)

function play() {
  if (props.embedUrl && !activated.value) return activate()
  if (ytPlayer) ytPlayer.playVideo()
  else if (vimeoPlayer) vimeoPlayer.play().catch(() => {})
  else videoEl.value?.play().catch(() => {})
}

function pause() {
  if (ytPlayer) ytPlayer.pauseVideo()
  else if (vimeoPlayer) vimeoPlayer.pause().catch(() => {})
  else videoEl.value?.pause()
}

function togglePlay() {
  if (playing.value) pause()
  else play()
}

const rate = ref(1)
/** Playback speed. Vimeo only allows it on some plans — then it just stays at 1×. */
function setRate(value: number) {
  rate.value = value
  if (videoEl.value) videoEl.value.playbackRate = value
  ytPlayer?.setPlaybackRate(value)
  vimeoPlayer?.setPlaybackRate(value).catch(() => (rate.value = 1))
  // The voice-over follows (files do this through ratechange).
  if (dubEl.value) dubEl.value.playbackRate = value
}
// A new file starts at normal speed; keep the chosen one. (Embeds get it in connect().)
watch(videoEl, (el) => el && rate.value !== 1 && (el.playbackRate = rate.value), { flush: 'post' })

// ── Native full screen (files) ─────────────────────────────────────────────
const trackUrl = ref<string | null>(null)
watch(
  () => [props.trackCues, props.trackSecondary] as const,
  ([cues, secondary]) => {
    if (trackUrl.value) URL.revokeObjectURL(trackUrl.value)
    trackUrl.value = import.meta.client && cues?.length ? URL.createObjectURL(new Blob([cuesToVtt(cues, secondary ?? [])], { type: 'text/vtt' })) : null
    nextTick(() => setNativeTrack(nativeFullscreen()))
  },
  { immediate: true }
)
onBeforeUnmount(() => trackUrl.value && URL.revokeObjectURL(trackUrl.value))

function nativeFullscreen() {
  return import.meta.client && !!videoEl.value && document.fullscreenElement === videoEl.value
}
function setNativeTrack(show: boolean) {
  const track = videoEl.value?.textTracks?.[0]
  if (track) track.mode = show ? 'showing' : 'disabled'
}
function onFullscreenChange() {
  setNativeTrack(nativeFullscreen())
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange))
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', onFullscreenChange))

defineExpose({ videoEl, seek, canSync, canControl, play, pause, togglePlay, setRate, rate, playing })
</script>
