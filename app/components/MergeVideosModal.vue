<template>
  <UModal v-model:open="open" title="Join into one video" description="The videos are joined in this order into a new video. The originals are not changed." :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <form id="merge-form" class="space-y-5" @submit.prevent="onSubmit">
        <!-- Order -->
        <section aria-labelledby="merge-order-h" class="space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <h3 id="merge-order-h" class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Order</h3>
            <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {{ list.length }} video{{ list.length === 1 ? '' : 's' }} · {{ totals.seconds ? formatDuration(totals.seconds) : '—' }}<template v-if="totals.unknown">
                + {{ totals.unknown }} of unknown length</template
              >
            </p>
          </div>
          <ol class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            <li v-for="(it, i) in list" :key="it.id" class="flex items-center gap-3 px-3 py-2" :class="it.blocked ? 'bg-error-50/60 dark:bg-error-950/30' : ''">
              <span class="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">{{ i + 1 }}</span>
              <div class="h-10 w-16 shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                <img v-if="it.thumbnailUrl" :src="it.thumbnailUrl" alt="" class="h-full w-full object-cover" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="it.title">{{ it.title }}</p>
                <p v-if="it.blocked" class="text-xs text-error-600 dark:text-error-400">This video {{ it.blocked }}</p>
                <p v-else class="text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ it.durationSeconds ? formatDuration(it.durationSeconds) : 'Length unknown' }}</p>
              </div>
              <div class="flex shrink-0 items-center">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" :aria-label="`Move ${it.title} up`" :disabled="i === 0" @click="move(i, -1)" />
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
          <h3 id="merge-new-h" class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">The new video</h3>
          <UFormField label="Title" required :error="errors.title">
            <UInput v-model="title" maxlength="200" class="w-full" aria-label="Title" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="description" :rows="2" autoresize :maxrows="6" maxlength="10000" class="w-full" />
          </UFormField>
          <UFormField label="Categories" :required="requireCategory" :error="errors.categoryIds" :hint="`Up to ${maxCategories}`">
            <USelectMenu v-model="categoryIds" :items="categoryItems" value-key="value" multiple placeholder="Choose categories" aria-label="Categories" class="w-full" />
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

        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-info"
          title="What to expect"
          description="Joining re-encodes every video, which takes a while for long ones. The new video is created hidden and has no transcript or subtitles; the originals keep theirs."
        />
        <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />
      </form>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="close">Cancel</UButton>
        <UButton type="submit" form="merge-form" icon="i-lucide-combine" :loading="saving" :disabled="!!problem || !title.trim()">Join {{ list.length }} videos</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Asks how to join the given videos into one: their order, the new video's title,
// its size and the joint between videos. Queues the job on the server and goes to
// the new (hidden) video, which shows the progress.
import { moveItem } from '#shared/utils/reorder'
import { DEFAULT_RESOLUTION, VIDEO_RESOLUTIONS, type VideoResolution } from '#shared/utils/audioVideo'
import { defaultMergeTitle, MERGE_TRANSITIONS, mergeProblem, mergeTotals, type MergeItem, type MergeTransition } from '#shared/utils/mergeVideos'

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

// Opening starts fresh from the videos it was given, in the order given.
watch(open, (isOpen) => {
  if (!isOpen) return
  list.value = props.items.map((i) => ({ ...i }))
  title.value = defaultMergeTitle(list.value.map((i) => i.title))
  description.value = ''
  categoryIds.value = []
  resolution.value = DEFAULT_RESOLUTION
  transition.value = 'NONE'
  errors.value = {}
  saveError.value = ''
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
