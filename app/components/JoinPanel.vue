<template>
  <div class="space-y-4 text-sm">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Pick videos from your library, put them in order and join them into one new video. Your originals are not changed.
    </p>

    <!-- ── Order ───────────────────────────────────────────────────────── -->
    <section class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <h3 :class="HEADING">
          Order <span class="normal-case font-normal">— total {{ formatDuration(totalSeconds) }}</span>
        </h3>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.join.soft"
          icon="i-lucide-play"
          :disabled="!edit.state.clips.length"
          @click="previewIndex = 0"
          >Preview</UButton
        >
      </div>

      <!-- Plays the videos back to back -->
      <div v-if="previewIndex !== null && previewClip" class="relative overflow-hidden rounded-md bg-black" data-testid="join-preview">
        <video :key="previewIndex" :src="previewClip.videoUrl ?? undefined" class="w-full aspect-video" controls autoplay playsinline @ended="nextPreview" />
        <div class="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
          Clip {{ previewIndex + 1 }} / {{ edit.state.clips.length }} · {{ previewClip.title }}
        </div>
        <UButton
          class="absolute right-2 top-2"
          size="xs"
          color="neutral"
          variant="solid"
          icon="i-lucide-x"
          aria-label="Close preview"
          @click="previewIndex = null"
        />
      </div>

      <ul class="divide-y divide-gray-100 dark:divide-gray-800 rounded-md border border-gray-200 dark:border-gray-800" data-testid="join-list">
        <li
          v-for="(c, i) in edit.state.clips"
          :key="`${c.id}-${i}`"
          class="px-2 py-1.5 space-y-1.5"
          :class="[
            dragIndex === i ? 'opacity-40' : '',
            dropLine(i) === 'before'
              ? 'shadow-[inset_0_2px_0_0_var(--ui-primary)]'
              : dropLine(i) === 'after'
                ? 'shadow-[inset_0_-2px_0_0_var(--ui-primary)]'
                : ''
          ]"
          draggable="true"
          @dragstart="onDragStart($event, i)"
          @dragover="onDragOver($event, i)"
          @drop.prevent="onDrop"
          @dragend="clearDrag"
        >
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-grip-vertical"
              class="w-4 h-4 shrink-0 cursor-grab text-gray-300 dark:text-gray-600"
              aria-hidden="true"
              title="Drag to reorder"
            />
            <span class="w-4 text-xs text-gray-400 tabular-nums">{{ i + 1 }}</span>
            <img v-if="c.thumbnailUrl" :src="c.thumbnailUrl" alt="" class="h-8 w-14 rounded object-cover bg-gray-100 dark:bg-gray-800" />
            <div v-else class="h-8 w-14 rounded bg-gray-100 dark:bg-gray-800" />
            <span class="flex-1 min-w-0">
              <span class="block truncate">{{ c.title }}</span>
              <span class="flex items-center gap-1.5 text-xs text-gray-500">
                <span>{{ c.id === video.id ? 'This video · ' : '' }}{{ formatDuration(c.durationSeconds) }}</span>
                <span v-if="c.blocked" class="text-error-500">{{ c.blocked }}</span>
                <UBadge
                  v-if="differsInShape(c)"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  title="Its picture has a different shape from this video, so it is scaled to fit the frame"
                >
                  different shape
                </UBadge>
              </span>
            </span>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-up"
              aria-label="Move earlier"
              :disabled="i === 0"
              @click="edit.move(i, i - 1)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-down"
              aria-label="Move later"
              :disabled="i === edit.state.clips.length - 1"
              @click="edit.move(i, i + 1)"
            />
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Remove"
              :disabled="c.id === video.id"
              :title="c.id === video.id ? 'The video you are editing stays in the result' : undefined"
              @click="removeAt(i)"
            />
          </div>
        </li>
      </ul>
    </section>

    <!-- ── Queued from other pages ─────────────────────────────────────── -->
    <section v-if="queue.length" class="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3" data-testid="join-queue">
      <h3 :class="HEADING">Waiting from the video pages</h3>
      <ul class="text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
        <li v-for="q in queue" :key="q.id" class="truncate">{{ q.title }}</li>
      </ul>
      <div class="flex gap-2">
        <UButton size="xs" icon="i-lucide-plus" @click="addQueued">Add {{ queue.length }} to the order</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="queue = []">Clear</UButton>
      </div>
    </section>

    <!-- ── Library ─────────────────────────────────────────────────────── -->
    <section class="sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-3" :class="TAB_ACCENTS.join.divider">
      <h3 :class="HEADING">Add a video</h3>
      <UInput v-model="search" size="sm" icon="i-lucide-search" placeholder="Search your videos" class="w-full" aria-label="Search videos" />
      <p v-if="loading" class="text-xs text-gray-500">Loading…</p>
      <p v-else-if="!choices.length" class="text-xs text-gray-500">No matching videos. Only videos stored in your library can be joined.</p>
      <ul v-else class="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-md border border-gray-200 dark:border-gray-800">
        <li v-for="v in choices" :key="v.id">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 disabled:opacity-50 disabled:hover:bg-transparent"
            :disabled="isAdded(v.id)"
            @click="add(v)"
          >
            <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" alt="" class="h-8 w-14 rounded object-cover bg-gray-100 dark:bg-gray-800" />
            <div v-else class="h-8 w-14 rounded bg-gray-100 dark:bg-gray-800" />
            <span class="flex-1 min-w-0 truncate">{{ v.title }}</span>
            <span class="text-xs text-gray-500 tabular-nums shrink-0">{{ formatDuration(v.durationSeconds) }}</span>
            <UBadge v-if="isAdded(v.id)" color="neutral" variant="subtle" size="sm">added</UBadge>
            <UIcon v-else name="i-lucide-plus" class="w-4 h-4 shrink-0" :class="TAB_ACCENTS.join.icon" />
          </button>
        </li>
      </ul>
    </section>

    <!-- ── Join ────────────────────────────────────────────────────────── -->
    <section class="space-y-2 border-t pt-3" :class="TAB_ACCENTS.join.divider">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        You choose the title, size, fade and categories next. The new video is created hidden until you have looked at it.
      </p>
      <p class="text-xs text-error-500 min-h-4">{{ problem }}</p>
      <UButton
        v-if="canWrite"
        color="neutral"
        :class="['w-full justify-center', TAB_ACCENTS.join.button]"
        icon="i-lucide-film"
        :disabled="!!problem"
        @click="showMerge = true"
      >
        Join {{ edit.state.clips.length }} video{{ edit.state.clips.length === 1 ? '' : 's' }}…
      </UButton>
    </section>

    <MergeVideosModal v-model="showMerge" :items="edit.state.clips" />
  </div>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
// The "Join" tab: pick videos from the library, put them in order, preview them
// back to back, then hand them to the merge dialog (MergeVideosModal), which
// makes one new, hidden video from them.
import type { Video } from '~/composables/useVideos'
import { useJoinQueue, joinClipFrom, type JoinClip, type JoinEdit } from '~/composables/useJoinEdit'
import { MAX_MERGE_VIDEOS, MIN_MERGE_VIDEOS, blockedReason, mergeProblem, mergeTotals } from '#shared/utils/mergeVideos'
import { formatDuration } from '#shared/utils/format'
import { dropIndex } from '#shared/utils/reorder'

const props = defineProps<{ video: Video; edit: JoinEdit; canWrite: boolean }>()

const HEADING = `text-xs font-semibold uppercase tracking-wide ${TAB_ACCENTS.join.heading}`
const toast = useToast()
const previewIndex = ref<number | null>(null)

const isAdded = (id: number) => props.edit.state.clips.some((c) => c.id === id)

/** A picture whose shape differs by more than a couple of percent from this video's. */
function differsInShape(c: JoinClip) {
  const { width, height } = props.video
  if (!width || !height || !c.width || !c.height || c.id === props.video.id) return false
  return Math.abs(c.width / c.height / (width / height) - 1) > 0.02
}

function removeAt(i: number) {
  props.edit.state.clips.splice(i, 1)
  previewIndex.value = null
}

function add(v: Video) {
  if (isAdded(v.id)) return
  if (!props.edit.add(joinClipFrom(v))) toast.add({ title: `At most ${MAX_MERGE_VIDEOS} videos`, color: 'warning' })
}

// ── Drag to reorder ─────────────────────────────────────────────────────────
const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)
const overHalf = ref<'before' | 'after'>('before')
function onDragStart(e: DragEvent, i: number) {
  dragIndex.value = i
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i)) // Firefox won't start a drag without data
  }
}
function onDragOver(e: DragEvent, i: number) {
  if (dragIndex.value === null) return
  e.preventDefault()
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  overIndex.value = i
  overHalf.value = e.clientY < r.top + r.height / 2 ? 'before' : 'after'
}
function clearDrag() {
  dragIndex.value = null
  overIndex.value = null
}
function onDrop() {
  if (dragIndex.value !== null && overIndex.value !== null) props.edit.move(dragIndex.value, dropIndex(dragIndex.value, overIndex.value, overHalf.value))
  clearDrag()
}
function dropLine(i: number): 'before' | 'after' | null {
  if (dragIndex.value === null || overIndex.value !== i) return null
  return dropIndex(dragIndex.value, i, overHalf.value) === dragIndex.value ? null : overHalf.value
}

// ── Preview: the clips back to back ─────────────────────────────────────────
const previewClip = computed(() => (previewIndex.value === null ? null : (props.edit.state.clips[previewIndex.value] ?? null)))
function nextPreview() {
  if (previewIndex.value === null) return
  previewIndex.value = previewIndex.value + 1 < props.edit.state.clips.length ? previewIndex.value + 1 : null
}

// ── Videos picked on other pages ────────────────────────────────────────────
const queue = useJoinQueue()
function addQueued() {
  let added = 0
  for (const q of queue.value) if (!isAdded(q.id) && props.edit.add(q)) added++
  queue.value = []
  if (added) toast.add({ title: `${added} video${added === 1 ? '' : 's'} added`, color: 'success' })
}

// ── Library search ──────────────────────────────────────────────────────────
const { list } = useVideos()
const search = ref('')
const found = ref<Video[]>([])
const loading = ref(false)
let seq = 0

async function load() {
  const mine = ++seq
  loading.value = true
  try {
    const res = await list({ search: search.value.trim() || undefined, size: 30, sortBy: 'createdAt', sortOrder: 'desc' })
    if (mine === seq) found.value = res.data
  } catch {
    if (mine === seq) found.value = []
  } finally {
    if (mine === seq) loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(load, 250)
})
onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))

// Only files in the library's storage can be joined (platform links have nothing to cut).
const choices = computed(() => found.value.filter((v) => !blockedReason(v)))

// ── Join ────────────────────────────────────────────────────────────────────
const showMerge = ref(false)
const totalSeconds = computed(() => mergeTotals(props.edit.state.clips).seconds)
const problem = computed(
  () =>
    mergeProblem(props.edit.state.clips) ??
    (props.edit.state.clips.length < MIN_MERGE_VIDEOS ? `Add at least ${MIN_MERGE_VIDEOS - props.edit.state.clips.length} more` : null)
)
</script>
