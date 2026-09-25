<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="font-semibold text-gray-900 dark:text-white">Subtitles</h2>
          <UBadge v-if="cues.length" color="neutral" variant="subtle" size="sm">{{ cues.length.toLocaleString() }}</UBadge>
        </div>
        <USelect
          v-if="tracks.length > 1"
          v-model="trackId"
          :items="trackOptions"
          size="sm"
          class="w-44"
          aria-label="Subtitle track"
          @update:model-value="(id) => loadCues(Number(id))"
        />
        <UButton v-else-if="track" size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-up-right" :to="`/subtitles/${track.id}`">
          {{ track.label }}
        </UButton>
      </div>
    </template>

    <UAlert v-if="error" color="error" variant="subtle" class="m-3" :title="error" icon="i-lucide-triangle-alert" />
    <div v-else-if="loading" class="p-4 space-y-3">
      <USkeleton v-for="n in 5" :key="n" class="h-8 w-full" />
    </div>
    <EmptyState
      v-else-if="!tracks.length"
      icon="i-lucide-subtitles"
      title="No subtitles yet"
      description="Create or upload a subtitle track to follow along here."
      class="py-8"
    />
    <EmptyState v-else-if="!cues.length" icon="i-lucide-subtitles" title="This track has no cues" class="py-8" />
    <template v-else>
      <p v-if="!canSeek" class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        This player can't be followed or jumped in — the lines are shown for reading only.
      </p>
      <ol ref="list" class="relative max-h-[28rem] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        <li v-for="(cue, i) in cues" :key="cue.id ?? i" :data-cue="i">
          <component
            :is="canSeek ? 'button' : 'div'"
            :type="canSeek ? 'button' : undefined"
            class="flex w-full gap-3 px-4 py-2 text-left transition-colors"
            :class="[
              i === activeIndex ? 'bg-primary-50 dark:bg-primary-950/40' : '',
              canSeek ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40' : ''
            ]"
            :aria-current="i === activeIndex ? 'true' : undefined"
            @click="canSeek && emit('seek', cue.startMs)"
          >
            <span class="shrink-0 w-16 pt-0.5 font-mono text-[11px] leading-4 tabular-nums text-primary-600 dark:text-primary-400">{{
              formatTimestamp(cue.startMs)
            }}</span>
            <span
              class="min-w-0 flex-1 text-sm whitespace-pre-line"
              :class="i === activeIndex ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'"
              >{{ cue.text }}</span
            >
          </component>
        </li>
      </ol>
    </template>
  </UCard>
</template>

<script setup lang="ts">
// A video's subtitle lines next to its player: highlights the line being
// spoken and, where the player supports it, jumps there on click. Opens on
// the default track (else the first published, else the first).
import type { Subtitle, SubtitleCue } from '~/composables/useSubtitles'

const props = defineProps<{
  videoId: number
  /** Player position in ms. */
  currentMs: number
  /** Whether the player reports its position and takes seeks. */
  canSeek: boolean
}>()
const emit = defineEmits<{ seek: [ms: number] }>()

const { list: listTracks, get: getTrack } = useSubtitles()

const tracks = ref<Subtitle[]>([])
const trackId = ref<number | undefined>()
const track = ref<Subtitle | null>(null)
const loading = ref(false)
const error = ref('')

const trackOptions = computed(() => tracks.value.map((t) => ({ label: `${t.label}${t.published ? '' : ' (draft)'}`, value: t.id })))
const cues = computed<SubtitleCue[]>(() => track.value?.cues ?? [])
const activeIndex = computed(() => activeCueIndex(cues.value, props.currentMs))

async function loadTracks() {
  loading.value = true
  error.value = ''
  try {
    tracks.value = (await listTracks({ videoId: props.videoId, size: 100 })).data
    const preferred = tracks.value.find((t) => t.isDefault) ?? tracks.value.find((t) => t.published) ?? tracks.value[0]
    trackId.value = preferred?.id
    track.value = null
    if (preferred) await loadCues(preferred.id)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadCues(id: number) {
  loading.value = true
  error.value = ''
  try {
    const loaded = await getTrack(id)
    // A quicker pick of another track wins.
    if (trackId.value === id) track.value = loaded
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    if (trackId.value === id) loading.value = false
  }
}

watch(() => props.videoId, loadTracks)
onMounted(loadTracks)

// Keeps the spoken line in view — scrolling only the list, never the page.
const list = ref<HTMLElement | null>(null)
watch(activeIndex, (i) => {
  if (i < 0 || !list.value) return
  const row = list.value.querySelector<HTMLElement>(`[data-cue="${i}"]`)
  if (!row) return
  const box = list.value
  if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
    box.scrollTo({ top: row.offsetTop - box.clientHeight / 3, behavior: 'smooth' })
  }
})
</script>
