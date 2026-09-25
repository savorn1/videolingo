<template>
  <div>
    <PageHeader :title="collection?.title ?? 'Collection'" :description="headerDescription" :crumbs="crumbs">
      <template v-if="collection" #actions>
        <UButton v-if="canManage" color="neutral" variant="soft" icon="i-lucide-list-video" :to="`/collections/${collectionId}`">Manage collection</UButton>
        <UButton v-else color="neutral" variant="soft" icon="i-lucide-list-video" :to="`/learn/collections/${collectionId}`">Course overview</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/collections">Back to collections</UButton>
      </template>
    </UAlert>

    <DetailSkeleton v-if="loading" :fields="3" />

    <EmptyState
      v-else-if="collection && !order.length"
      icon="i-lucide-list-video"
      title="Nothing to play"
      :description="items.length ? 'Every video in this collection is in the trash.' : 'This collection has no videos yet.'"
    >
      <template v-if="canManage" #action>
        <UButton icon="i-lucide-plus" :to="`/collections/${collectionId}`">Add videos</UButton>
      </template>
    </EmptyState>

    <div v-else-if="collection" class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <!-- ── Player ──────────────────────────────────────────────────────── -->
      <div class="xl:col-span-2 space-y-3 xl:sticky xl:top-4">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="relative">
            <VideoPlayer
              v-if="video && tracker.ready.value"
              :key="`${video.id}-${replay}`"
              :embed-url="video.embedUrl"
              :video-url="video.videoUrl"
              :poster="video.thumbnailUrl"
              :title="video.title"
              :vertical="!!video.width && !!video.height && video.height > video.width"
              :resume-key="video.id"
              :start-at="replay ? null : tracker.startAt.value"
              :autoplay="started"
              @time="tracker.onTime"
              @ended="onEnded"
            />
            <div v-else class="w-full aspect-video bg-black rounded-lg flex items-center justify-center text-white/60 text-sm">
              {{ videoError || 'Loading…' }}
            </div>

            <!-- Up next -->
            <div v-if="countdown !== null && upNext" class="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-lg p-6">
              <div class="text-center text-white space-y-3 max-w-sm">
                <p class="text-sm text-white/70">Up next in {{ countdown }}…</p>
                <p class="text-lg font-semibold line-clamp-2">{{ upNext.title ?? `Video #${upNext.videoId}` }}</p>
                <div class="flex justify-center gap-2">
                  <UButton color="neutral" variant="soft" @click="cancelCountdown">Cancel</UButton>
                  <UButton icon="i-lucide-skip-forward" @click="goNext(true)">Play now</UButton>
                </div>
              </div>
            </div>
            <div v-else-if="finished" class="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-lg">
              <div class="text-center text-white space-y-3">
                <UIcon name="i-lucide-party-popper" class="w-8 h-8" />
                <p class="font-semibold">You've reached the end of “{{ collection.title }}”</p>
                <UButton icon="i-lucide-rotate-ccw" @click="playFromStart">Play again</UButton>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <UTooltip text="Previous (Shift+P)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-skip-back"
                aria-label="Previous video"
                :disabled="prevItem === null"
                @click="goPrevious"
              />
            </UTooltip>
            <UTooltip text="Next (Shift+N)">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-skip-forward"
                aria-label="Next video"
                :disabled="nextItem === null"
                @click="goNext(false)"
              />
            </UTooltip>
            <UTooltip :text="shuffle ? 'Shuffle is on' : 'Shuffle'">
              <UButton
                :color="shuffle ? 'primary' : 'neutral'"
                :variant="shuffle ? 'soft' : 'ghost'"
                icon="i-lucide-shuffle"
                aria-label="Shuffle"
                @click="toggleShuffle"
              />
            </UTooltip>
            <UTooltip :text="REPEAT_LABELS[repeat]">
              <UButton
                :color="repeat === 'off' ? 'neutral' : 'primary'"
                :variant="repeat === 'off' ? 'ghost' : 'soft'"
                :icon="repeat === 'one' ? 'i-lucide-repeat-1' : 'i-lucide-repeat'"
                :aria-label="REPEAT_LABELS[repeat]"
                @click="cycleRepeat"
              />
            </UTooltip>
            <USwitch v-model="autoAdvance" size="sm" label="Autoplay next" class="ml-1" />
            <span class="ml-auto text-sm text-gray-500 tabular-nums">
              {{ positionInOrder + 1 }} / {{ order.length }}<template v-if="remainingSeconds"> · {{ formatDuration(remainingSeconds) }} left</template>
            </span>
          </div>
        </UCard>

        <UCard v-if="video">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ video.title }}</h2>
              <p class="text-sm text-gray-500">
                {{ languageLabel(video.language) }}<template v-if="video.durationSeconds"> · {{ formatDuration(video.durationSeconds) }}</template> ·
                {{ video.viewCount.toLocaleString() }} view{{ video.viewCount === 1 ? '' : 's' }}
              </p>
            </div>
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-external-link" :to="`/videos/${video.id}`">Open video</UButton>
          </div>
          <p v-if="video.source === 'FACEBOOK'" class="mt-2 text-xs text-warning-600 dark:text-warning-400">
            Facebook's player doesn't say when a video ends — press Next to move on.
          </p>
          <p v-if="video.description" class="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line line-clamp-4">{{ video.description }}</p>
        </UCard>
      </div>

      <!-- ── Queue ───────────────────────────────────────────────────────── -->
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white">{{ shuffle ? 'Queue (shuffled)' : 'Queue' }}</h2>
            <UBadge v-if="watchedCount" :color="watchedCount === order.length ? 'success' : 'neutral'" variant="subtle" size="sm" icon="i-lucide-circle-check">
              {{ watchedCount }} of {{ order.length }} watched
            </UBadge>
            <span class="text-xs text-gray-500"
              >{{ order.length }} video{{ order.length === 1 ? '' : 's' }}<template v-if="totalSeconds"> · {{ formatDuration(totalSeconds) }}</template></span
            >
          </div>
        </template>
        <ol ref="queueEl" class="max-h-[70vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          <li v-for="(i, n) in queueRows" :key="items[i]!.videoId">
            <button
              type="button"
              class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
              :class="[
                i === current ? 'bg-primary-50 dark:bg-primary-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                items[i]!.deleted ? 'opacity-50 cursor-not-allowed' : ''
              ]"
              :disabled="items[i]!.deleted"
              :data-current="i === current || undefined"
              @click="playItem(i)"
            >
              <span class="w-6 shrink-0 text-center text-xs tabular-nums text-gray-400">
                <UIcon v-if="i === current" name="i-lucide-audio-lines" class="w-4 h-4 text-primary-500" />
                <UIcon v-else-if="progressOf(i)?.completed" name="i-lucide-circle-check" class="w-4 h-4 text-success-500" aria-label="Watched" />
                <template v-else>{{ n + 1 }}</template>
              </span>
              <span class="relative w-24 aspect-video shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img
                  v-if="items[i]!.thumbnailUrl && !brokenThumbs.has(items[i]!.videoId)"
                  :src="items[i]!.thumbnailUrl!"
                  alt=""
                  loading="lazy"
                  class="w-full h-full object-cover"
                  @error="brokenThumbs.add(items[i]!.videoId)"
                />
                <UIcon v-else name="i-lucide-clapperboard" class="absolute inset-0 m-auto w-4 h-4 text-gray-400" />
                <span
                  v-if="progressOf(i) && !progressOf(i)!.completed && progressOf(i)!.percent"
                  class="absolute bottom-0 left-0 h-0.5 bg-primary-500"
                  :style="{ width: `${progressOf(i)!.percent}%` }"
                />
                <span
                  v-if="items[i]!.durationSeconds"
                  class="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-semibold text-white tabular-nums"
                >
                  {{ formatDuration(items[i]!.durationSeconds) }}
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block text-sm font-medium truncate"
                  :class="i === current ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'"
                >
                  {{ items[i]!.title ?? `Video #${items[i]!.videoId}` }}
                </span>
                <span class="block text-xs text-gray-500 truncate">
                  <template v-if="items[i]!.deleted">In the trash — skipped</template>
                  <template v-else-if="i === current">Now playing</template>
                  <template v-else>{{ languageLabel(items[i]!.language) }}</template>
                </span>
              </span>
            </button>
          </li>
        </ol>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Plays a collection like a playlist: its videos in collection order (or
// shuffled), one after another, with a queue to jump around in. ?v=<videoId>
// starts from that video; the URL follows along so a refresh resumes there.
import type { Collection, CollectionVideo } from '~/composables/useCollections'
import type { Video } from '~/composables/useVideos'
import type { WatchProgress } from '~/composables/useWatchProgress'
import type { RepeatMode } from '#shared/utils/playlist'

// Open to every signed-in account: it reads the learner API, which only
// serves watchable videos from collections the viewer may see.
const route = useRoute()
const router = useRouter()
const { collection: getLearnCollection, watch: getWatchPage } = useLearn()
const { can } = useAuth()
const canManage = computed(() => can('collections', 'READ'))

const collectionId = computed(() => Number(route.params.id))
const crumbs = computed(() =>
  canManage.value
    ? [{ label: 'Collections', to: '/collections' }, { label: collection.value?.title ?? '…', to: `/collections/${collectionId.value}` }, { label: 'Play' }]
    : [{ label: 'Learn', to: '/learn' }, { label: collection.value?.title ?? '…', to: `/learn/collections/${collectionId.value}` }, { label: 'Play' }]
)
const collection = ref<Collection | null>(null)
const items = ref<CollectionVideo[]>([])
const loading = ref(true)
const error = ref('')
const brokenThumbs = reactive(new Set<number>())

// ── Preferences (remembered in this browser) ──────────────────────────────
const PREFS_KEY = 'videolingo:playlist'
function readPrefs(): { autoAdvance?: boolean; repeat?: RepeatMode } {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const autoAdvance = ref(true)
const repeat = ref<RepeatMode>('off')
watch([autoAdvance, repeat], () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ autoAdvance: autoAdvance.value, repeat: repeat.value }))
  } catch {
    // Only a convenience.
  }
})
const REPEAT_LABELS: Record<RepeatMode, string> = { off: 'Repeat is off', all: 'Repeating the collection', one: 'Repeating this video' }
function cycleRepeat() {
  repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off'
}

// ── Queue ─────────────────────────────────────────────────────────────────
const playable = computed(() => items.value.map((it, i) => (it.deleted ? -1 : i)).filter((i) => i >= 0))
const shuffle = ref(route.query.shuffle === '1')
const shuffled = ref<number[]>([])
const order = computed(() => (shuffle.value ? shuffled.value : playable.value))
/** Index into `items` of what's playing. */
const current = ref(-1)
const positionInOrder = computed(() => Math.max(0, order.value.indexOf(current.value)))
// Shuffled: the queue shows play order (trashed ones after). Otherwise collection order.
const queueRows = computed(() =>
  shuffle.value ? [...order.value, ...items.value.map((_, i) => i).filter((i) => !order.value.includes(i))] : items.value.map((_, i) => i)
)

const nextItem = computed(() => nextIndex(order.value, current.value, repeat.value, false))
const prevItem = computed(() => previousIndex(order.value, current.value, repeat.value))
const upNext = computed(() => {
  const i = nextIndex(order.value, current.value, repeat.value, true)
  return i === null ? null : items.value[i]!
})

const totalSeconds = computed(() => order.value.reduce((sum, i) => sum + (items.value[i]!.durationSeconds ?? 0), 0))
const remainingSeconds = computed(() => order.value.slice(positionInOrder.value).reduce((sum, i) => sum + (items.value[i]!.durationSeconds ?? 0), 0))

const headerDescription = computed(() => {
  const c = collection.value
  if (!c) return undefined
  return `Playing the collection — ${order.value.length} video${order.value.length === 1 ? '' : 's'}${totalSeconds.value ? `, ${formatDuration(totalSeconds.value)}` : ''}`
})

function toggleShuffle() {
  shuffle.value = !shuffle.value
  if (shuffle.value) shuffled.value = shuffledOrder(playable.value, current.value)
  router.replace({ query: { ...route.query, shuffle: shuffle.value ? '1' : undefined } })
}

// ── Progress (this user's, saved on the server) ────────────────────────────
const tracker = useProgressTracker()
const { forVideos } = useWatchProgress()
const progressByVideo = ref(new Map<number, WatchProgress>())
const progressOf = (i: number) => progressByVideo.value.get(items.value[i]!.videoId)
const watchedCount = computed(() => order.value.filter((i) => progressOf(i)?.completed).length)
watch(tracker.progress, (p) => {
  if (p) progressByVideo.value = new Map(progressByVideo.value).set(p.videoId, p)
})

// ── Playing ───────────────────────────────────────────────────────────────
const video = ref<Video | null>(null)
const videoError = ref('')
const cache = new Map<number, Video>()
/** Autoplay only after the first choice — browsers block sound nobody asked for. */
const started = ref(false)
/** Bumped to restart the same video (repeat-one, play again). */
const replay = ref(0)
const finished = ref(false)

let loadSeq = 0
async function playItem(i: number, autoplay = true) {
  const item = items.value[i]
  if (!item || item.deleted) return
  cancelCountdown()
  finished.value = false
  if (autoplay) started.value = true
  if (i === current.value && video.value) {
    replay.value++
    return
  }
  current.value = i
  tracker.start(item.videoId, item.durationSeconds)
  router.replace({ query: { ...route.query, v: String(item.videoId) } })
  nextTick(() => document.querySelector('[data-current]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  const seq = ++loadSeq
  videoError.value = ''
  video.value = cache.get(item.videoId) ?? null
  if (video.value) return
  try {
    const v = (await getWatchPage(item.videoId)).video
    cache.set(v.id, v)
    if (seq === loadSeq) video.value = v
  } catch (err) {
    if (seq === loadSeq) videoError.value = apiErrorMessage(err)
  }
}

function goNext(fromCountdown: boolean) {
  const i = fromCountdown ? nextIndex(order.value, current.value, repeat.value, true) : nextItem.value
  if (i !== null) playItem(i)
}
function goPrevious() {
  if (prevItem.value !== null) playItem(prevItem.value)
}
function playFromStart() {
  if (shuffle.value) shuffled.value = shuffledOrder(playable.value, null)
  const first = order.value[0]
  if (first !== undefined) {
    current.value = -1
    playItem(first)
  }
}

// ── End of a video: count down, then move on ───────────────────────────────
const COUNTDOWN_SECONDS = 5
const countdown = ref<number | null>(null)
let countdownTimer: ReturnType<typeof setInterval> | undefined
function cancelCountdown() {
  clearInterval(countdownTimer)
  countdown.value = null
}
function onEnded() {
  tracker.onEnded()
  if (repeat.value === 'one') {
    replay.value++
    return
  }
  if (!upNext.value) {
    finished.value = true
    return
  }
  if (!autoAdvance.value) return
  countdown.value = COUNTDOWN_SECONDS
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    if (countdown.value === null) return clearInterval(countdownTimer)
    countdown.value--
    if (countdown.value <= 0) {
      cancelCountdown()
      goNext(true)
    }
  }, 1000)
}
onBeforeUnmount(() => clearInterval(countdownTimer))

defineShortcuts({
  shift_n: () => goNext(false),
  shift_p: () => goPrevious()
})

// ── Load ──────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value = ''
  try {
    // The collection with its watchable videos, in order.
    const res = await getLearnCollection(collectionId.value)
    collection.value = res.collection
    const all: CollectionVideo[] = res.videos
    items.value = all
    try {
      progressByVideo.value = await forVideos(all.map((it) => it.videoId))
    } catch {
      // Just no ✓ marks.
    }
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
  const requested = Number(route.query.v)
  const startAt = items.value.findIndex((it) => it.videoId === requested && !it.deleted)
  const first = startAt >= 0 ? startAt : (playable.value[0] ?? -1)
  if (shuffle.value) shuffled.value = shuffledOrder(playable.value, startAt >= 0 ? startAt : null)
  const begin = shuffle.value && startAt < 0 ? (shuffled.value[0] ?? -1) : first
  // Opened from a Play button — a click, so starting straight away is allowed.
  if (begin >= 0) playItem(begin, route.query.autoplay !== '0')
}

onMounted(() => {
  const prefs = readPrefs()
  if (typeof prefs.autoAdvance === 'boolean') autoAdvance.value = prefs.autoAdvance
  if (prefs.repeat === 'off' || prefs.repeat === 'all' || prefs.repeat === 'one') repeat.value = prefs.repeat
  load()
})
</script>
