<template>
  <UModal
    v-model:open="open"
    title="Join into one video"
    description="The videos are joined in this order into a new video. The originals are not changed."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form id="merge-form" class="space-y-5" :class="TAB_ACCENTS.join.scope" @submit.prevent="onSubmit">
        <!-- Order -->
        <section aria-labelledby="merge-order-h" class="space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <h3 id="merge-order-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.join.heading">Order</h3>
            <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {{ list.length }} video{{ list.length === 1 ? '' : 's' }} · {{ totals.seconds ? formatDuration(totals.seconds) : '—'
              }}<template v-if="totals.unknown"> + {{ totals.unknown }} of unknown length</template>
            </p>
          </div>
          <!-- The joined video at a glance: each part's share of its length -->
          <div
            v-if="list.length"
            class="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            role="img"
            :aria-label="`Timeline of the joined video, in ${list.length} parts`"
          >
            <span
              v-for="(it, i) in list"
              :key="it.id"
              class="h-full border-r border-white/70 last:border-r-0 dark:border-gray-900"
              :class="SEGMENT_COLORS[i % SEGMENT_COLORS.length]"
              :style="{ width: `${shares[i]}%` }"
              :title="`${i + 1}. ${it.title}`"
            />
          </div>
          <ol class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            <li
              v-for="(it, i) in list"
              :key="it.id"
              draggable="true"
              class="flex items-center gap-3 px-3 py-2"
              :class="[
                it.blocked ? 'bg-error-50/60 dark:bg-error-950/30' : '',
                dragId === it.id ? 'opacity-40' : '',
                dropLine(i) === 'before'
                  ? 'shadow-[inset_0_2px_0_0_var(--ui-primary)]'
                  : dropLine(i) === 'after'
                    ? 'shadow-[inset_0_-2px_0_0_var(--ui-primary)]'
                    : ''
              ]"
              @dragstart="onDragStart($event, it.id)"
              @dragover="onDragOver($event, i)"
              @drop.prevent="onDrop"
              @dragend="clearDrag"
            >
              <UIcon
                name="i-lucide-grip-vertical"
                class="h-4 w-4 shrink-0 cursor-grab text-gray-300 dark:text-gray-600"
                aria-hidden="true"
                title="Drag to reorder"
              />
              <span class="flex w-8 shrink-0 items-center justify-end gap-1.5 text-xs tabular-nums text-gray-400">
                <span class="h-2 w-2 rounded-full" :class="SEGMENT_COLORS[i % SEGMENT_COLORS.length]" aria-hidden="true" />{{ i + 1 }}
              </span>
              <div class="h-10 w-16 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <img v-if="it.thumbnailUrl" :src="it.thumbnailUrl" alt="" class="h-full w-full object-cover" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="it.title">{{ it.title }}</p>
                <p v-if="it.blocked" class="text-xs text-error-600 dark:text-error-400">This video {{ it.blocked }}</p>
                <p v-else class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {{ it.durationSeconds ? formatDuration(it.durationSeconds) : 'Length unknown'
                  }}<template v-if="starts[i] !== null"> · starts at {{ formatDuration(starts[i]) }}</template>
                </p>
              </div>
              <div class="flex shrink-0 items-center">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-up"
                  :aria-label="`Move ${it.title} up`"
                  :disabled="i === 0"
                  @click="move(i, -1)"
                />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-arrow-down"
                  :aria-label="`Move ${it.title} down`"
                  :disabled="i === list.length - 1"
                  @click="move(i, 1)"
                />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Leave ${it.title} out`" @click="leaveOut(it.id)" />
              </div>
            </li>
          </ol>
          <p v-if="problem" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ problem }}</p>
        </section>

        <!-- The new video -->
        <section aria-labelledby="merge-new-h" class="space-y-4">
          <h3 id="merge-new-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.join.heading">The new video</h3>
          <UFormField label="Title" required :error="errors.title">
            <UInput v-model="title" maxlength="200" class="w-full" aria-label="Title" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="description" :rows="2" autoresize :maxrows="6" maxlength="10000" class="w-full" />
          </UFormField>
          <UFormField label="Categories" :required="requireCategory" :error="errors.categoryIds" :hint="`Up to ${maxCategories}`">
            <USelectMenu
              v-model="categoryIds"
              :items="categoryItems"
              value-key="value"
              multiple
              placeholder="Choose categories"
              aria-label="Categories"
              class="w-full"
            />
          </UFormField>

          <div class="space-y-2">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Video size</p>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Video size">
              <UButton
                v-for="r in VIDEO_RESOLUTIONS"
                :key="r.value"
                size="sm"
                :color="resolution === r.value ? 'primary' : 'neutral'"
                :variant="resolution === r.value ? 'soft' : 'ghost'"
                :aria-pressed="resolution === r.value"
                @click="resolution = r.value"
              >
                {{ r.label }} <span class="text-xs opacity-70 tabular-nums">{{ r.size }}</span>
              </UButton>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Every video is fitted inside this frame with black bars where the shape differs (vertical videos get bars at the sides).
            </p>
          </div>

          <div class="space-y-2">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Between videos</p>
            <div class="flex flex-wrap gap-2" role="group" aria-label="Between videos">
              <UButton
                v-for="t in MERGE_TRANSITIONS"
                :key="t.value"
                size="sm"
                :color="transition === t.value ? 'primary' : 'neutral'"
                :variant="transition === t.value ? 'soft' : 'ghost'"
                :aria-pressed="transition === t.value"
                :title="t.hint"
                @click="transition = t.value"
              >
                {{ t.label }}
              </UButton>
            </div>
          </div>
        </section>

        <UAlert color="info" variant="subtle" icon="i-lucide-info" title="What to expect" :description="expectText" />
        <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />
      </form>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="close">Cancel</UButton>
        <UButton
          type="submit"
          form="merge-form"
          color="neutral"
          :class="TAB_ACCENTS.join.button"
          icon="i-lucide-combine"
          :loading="saving"
          :disabled="!!problem || !title.trim()"
          >Join {{ list.length }} videos</UButton
        >
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
// Asks how to join the given videos into one: their order, the new video's title,
// its size and the joint between videos. Queues the job on the server and goes to
// the new (hidden) video, which shows the progress.
import { dropIndex, moveItem } from '#shared/utils/reorder'
import { DEFAULT_RESOLUTION, VIDEO_RESOLUTIONS, type VideoResolution } from '#shared/utils/audioVideo'
import {
  defaultMergeTitle,
  describeEstimate,
  estimateMergeSeconds,
  MERGE_TRANSITIONS,
  mergeProblem,
  mergeShares,
  mergeStarts,
  mergeTotals,
  sanitizeMergeLook,
  type MergeItem,
  type MergeTransition
} from '#shared/utils/mergeVideos'

const props = defineProps<{ items: MergeItem[] }>()
const open = defineModel<boolean>({ default: false })

const videos = useVideos()
const { settings: clientSettings } = useClientSettings()
const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

const list = ref<MergeItem[]>([])
const title = ref('')
const description = ref('')
const categoryIds = ref<number[]>([])
const resolution = ref<VideoResolution>(DEFAULT_RESOLUTION)
const transition = ref<MergeTransition>('NONE')
const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)

const categoryItems = computed(() => categoryOptions(categoryIds.value).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))
const totals = computed(() => mergeTotals(list.value))
const problem = computed(() => mergeProblem(list.value))
const starts = computed(() => mergeStarts(list.value))
const shares = computed(() => mergeShares(list.value))
// Same colours as the split tab's strip, so a part keeps its colour from the bar to its row.
const SEGMENT_COLORS = ['bg-primary-500', 'bg-info-500', 'bg-success-500', 'bg-warning-500', 'bg-violet-500', 'bg-rose-500']
const expectText = computed(() => {
  const when = totals.value.seconds
    ? ` A rough guess for this one: ${describeEstimate(estimateMergeSeconds(totals.value.seconds, resolution.value))}, plus any wait behind other jobs.`
    : ''
  return `Joining re-encodes every video, so it takes a while for long ones.${when} The new video is created hidden. Transcripts every video has in the same language are carried over; subtitles are not, and the originals keep theirs.`
})

// ── Remember the size and the joint between videos ───────────────────────────
const { load: loadPrefs, appValue, setApp } = useLearnerPrefs()
const LOOK_KEY = 'mergeLook'
let lookReady = false
watch([resolution, transition], () => {
  if (lookReady) setApp(LOOK_KEY, { resolution: resolution.value, transition: transition.value })
})

// ── Drag to reorder (the arrow buttons do the same from the keyboard) ────────
const dragId = ref<number | null>(null)
const overIndex = ref<number | null>(null)
const overHalf = ref<'before' | 'after'>('before')
function onDragStart(event: DragEvent, id: number) {
  dragId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id)) // Firefox won't start a drag without data
  }
}
function onDragOver(event: DragEvent, index: number) {
  if (dragId.value === null) return
  event.preventDefault() // marks the row as a drop target
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  overIndex.value = index
  overHalf.value = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}
function clearDrag() {
  dragId.value = null
  overIndex.value = null
}
function onDrop() {
  const from = list.value.findIndex((i) => i.id === dragId.value)
  if (from >= 0 && overIndex.value !== null) list.value = moveItem(list.value, from, dropIndex(from, overIndex.value, overHalf.value))
  clearDrag()
}
/** Where to draw the drop line on row `i`: only when dropping there would actually move the video. */
function dropLine(i: number): 'before' | 'after' | null {
  if (dragId.value === null || overIndex.value !== i) return null
  const from = list.value.findIndex((x) => x.id === dragId.value)
  return dropIndex(from, i, overHalf.value) === from ? null : overHalf.value
}

// Opening starts fresh from the videos it was given, in the order given.
watch(open, async (isOpen) => {
  if (!isOpen) return
  list.value = props.items.map((i) => ({ ...i }))
  title.value = defaultMergeTitle(list.value.map((i) => i.title))
  description.value = ''
  categoryIds.value = []
  resolution.value = DEFAULT_RESOLUTION
  transition.value = 'NONE'
  errors.value = {}
  saveError.value = ''
  clearDrag()
  // The size and joint used last time, if there was one.
  lookReady = false
  await loadPrefs()
  const look = sanitizeMergeLook(appValue<unknown>(LOOK_KEY, null))
  resolution.value = look.resolution
  transition.value = look.transition
  lookReady = true
})

function move(index: number, by: -1 | 1) {
  list.value = moveItem(list.value, index, index + by)
}
function leaveOut(id: number) {
  list.value = list.value.filter((i) => i.id !== id)
}

async function onSubmit() {
  errors.value = {}
  saveError.value = ''
  if (problem.value) return
  if (!title.value.trim()) errors.value.title = 'Give the new video a title'
  if (requireCategory.value && !categoryIds.value.length) errors.value.categoryIds = 'Choose at least one category'
  if (categoryIds.value.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
  if (Object.keys(errors.value).length) return

  saving.value = true
  try {
    const result = await videos.mergeVideos({
      videoIds: list.value.map((i) => i.id),
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      resolution: resolution.value,
      transition: transition.value,
      categoryIds: categoryIds.value
    })
    open.value = false
    useToast().add({ title: 'Joining the videos', description: 'You can leave; it keeps going in the background.', color: 'success' })
    await navigateTo(`/videos/${result.video.id}`)
  } catch (err) {
    saveError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>
