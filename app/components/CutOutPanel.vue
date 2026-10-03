<template>
  <EditorSection
    v-model:open="open"
    title="Cut out"
    :changed="cuts.length > 0"
    :hint="cuts.length ? `${cuts.length} cut${cuts.length === 1 ? '' : 's'}` : ''"
    data-testid="cut-out"
  >
    <div v-if="cuts.length" class="flex justify-end">
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" @click="cuts = []">Clear all</UButton>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Take a section out of the video; what is left plays on as one video. Mark where it starts and ends at the playhead, or type the times.
    </p>

    <div class="flex flex-wrap items-center gap-1">
      <UButton
        v-if="markStart == null"
        size="xs"
        color="neutral"
        variant="soft"
        icon="i-lucide-scissors"
        data-testid="cut-mark-start"
        @click="markStart = Math.round(currentMs)"
      >
        Mark start here
      </UButton>
      <template v-else>
        <UButton size="xs" color="neutral" :class="TAB_ACCENTS.trim.button" icon="i-lucide-check" data-testid="cut-mark-end" @click="markEnd">
          End cut here ({{ formatTimecode(markStart) }} → {{ formatTimecode(currentMs) }})
        </UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="markStart = null">Cancel</UButton>
      </template>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" @click="addEmpty">Add by time</UButton>
    </div>

    <!-- What stays (solid) and what goes (striped), over the whole video -->
    <div
      v-if="durationMs && cuts.length"
      class="relative h-2 overflow-hidden rounded-full bg-primary-500/70"
      role="img"
      :aria-label="`Result ${formatTimecode(resultMs)} long`"
    >
      <span
        v-for="(c, i) in merged"
        :key="i"
        class="absolute inset-y-0 bg-error-500"
        :style="{ left: `${(c.startMs / durationMs) * 100}%`, width: `${((c.endMs - c.startMs) / durationMs) * 100}%` }"
      />
    </div>

    <ul v-if="cuts.length" class="space-y-1">
      <li v-for="(c, i) in cuts" :key="i" class="flex items-center gap-1" data-testid="cut-row">
        <span class="w-5 text-xs text-gray-500">{{ i + 1 }}</span>
        <UInput
          :model-value="formatTimecode(c.startMs)"
          size="xs"
          class="w-24"
          :aria-label="`Cut ${i + 1} start`"
          @change="(e: Event) => setTime(i, 'startMs', e.target as HTMLInputElement)"
        />
        <span class="text-xs text-gray-500">→</span>
        <UInput
          :model-value="formatTimecode(c.endMs)"
          size="xs"
          class="w-24"
          :aria-label="`Cut ${i + 1} end`"
          @change="(e: Event) => setTime(i, 'endMs', e.target as HTMLInputElement)"
        />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-map-pin"
          :aria-label="`Go to cut ${i + 1}`"
          title="Go to its start"
          @click="emit('seek', c.startMs)"
        />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Remove cut ${i + 1}`" title="Remove" @click="cuts.splice(i, 1)" />
      </li>
    </ul>

    <template v-if="cuts.length">
      <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="cut-summary">{{ summary }}</p>
      <p v-if="durationMs > LONG_VIDEO_MS" class="text-xs text-gray-500 dark:text-gray-400" data-testid="cut-long-note">
        This is a long video: the cut re-encodes all of it, so it can take a while to finish. It runs in the background.
      </p>
      <p v-if="durationMs > LONG_VIDEO_MS" class="text-xs text-gray-500 dark:text-gray-400" data-testid="cut-long-note">
        This is a long video: the cut re-encodes all of it, so it can take a while to finish. It runs in the background.
      </p>
      <p class="min-h-4 text-xs text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
      <UButton
        v-if="canWrite"
        block
        color="neutral"
        :class="TAB_ACCENTS.trim.button"
        icon="i-lucide-scissors"
        :loading="starting"
        :disabled="!!error || busy"
        data-testid="start-cut"
        @click="emit('start')"
      >
        Start cut
      </UButton>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { cutBetween, snapCut, lengthAfterCuts, mergeCutRanges, validateCutOut, type CutRange } from '#shared/utils/cutOut'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'

const cuts = defineModel<CutRange[]>({ required: true })
const props = defineProps<{ currentMs: number; durationMs: number; canWrite: boolean; busy: boolean; starting: boolean }>()
const emit = defineEmits<{ seek: [ms: number]; start: [] }>()

const open = ref(false)
// Cuts from a draft or an undo show up open.
watch(
  () => cuts.value.length,
  (n, old) => {
    if (n > 0 && !old) open.value = true
  },
  { immediate: true }
)
/** Above this the cut is slow enough to say so. */
const LONG_VIDEO_MS = 30 * 60 * 1000
const toast = useToast()
const markStart = ref<number | null>(null)
const merged = computed(() => mergeCutRanges(cuts.value))
const resultMs = computed(() => lengthAfterCuts(cuts.value, props.durationMs))
const error = computed(() => validateCutOut(cuts.value, Math.round(props.durationMs) || null))
const summary = computed(() => {
  const removed = Math.max(0, props.durationMs - resultMs.value)
  return `${cuts.value.length} cut${cuts.value.length === 1 ? '' : 's'} take out ${formatTimecode(removed)}; the result is ${formatTimecode(resultMs.value)} long.`
})

function markEnd() {
  if (markStart.value == null) return
  const range = cutBetween(markStart.value, props.currentMs, props.durationMs)
  markStart.value = null
  if (range) cuts.value = [...cuts.value, range]
}

function addEmpty() {
  const start = Math.round(Math.min(props.currentMs, Math.max(0, props.durationMs - 1000)))
  cuts.value = [...cuts.value, { startMs: start, endMs: Math.min(Math.round(props.durationMs) || start + 1000, start + 1000) }]
}

function setTime(i: number, edge: 'startMs' | 'endMs', input: HTMLInputElement) {
  const ms = parseTimecode(input.value)
  const c = cuts.value[i]
  if (!c) return
  if (ms == null) {
    toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
  } else {
    c[edge] = ms
    Object.assign(c, snapCut(c, props.durationMs))
  }
  // Show the accepted value, or put the old one back.
  input.value = formatTimecode(c[edge])
}
</script>
