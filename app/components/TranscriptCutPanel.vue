<template>
  <EditorSection
    v-model:open="open"
    title="Edit by transcript"
    :changed="removedCount > 0"
    :hint="removedCount ? `${removedCount} sentence${removedCount === 1 ? '' : 's'} out` : ''"
    data-testid="transcript-cut"
  >
    <p v-if="error" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
    <USkeleton v-else-if="loading" class="h-16 w-full" />
    <p v-else-if="!sentences.length" class="text-xs text-gray-500 dark:text-gray-400">
      This video has no transcript yet. Make one from the video's page (Transcribe), then cross out sentences here to cut them.
    </p>
    <template v-else>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Click a sentence to cut it out (click again to bring it back); click its time to hear it. The pause between two cut sentences goes too. They become cuts
        under Cut out.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-if="transcripts.length > 1"
          v-model="transcriptId"
          :items="transcripts.map((t) => ({ label: languageLabel(t.language), value: t.id }))"
          size="xs"
          class="w-36"
          aria-label="Transcript"
        />
        <UInput v-model="search" size="xs" icon="i-lucide-search" placeholder="Find words…" class="min-w-0 flex-1" aria-label="Find in the transcript" />
      </div>
      <div v-if="hasWords" class="flex flex-wrap items-center gap-2">
        <USwitch v-model="byWord" size="sm" label="Cut by word" />
        <UButton v-if="fillers.length" size="xs" color="neutral" variant="soft" icon="i-lucide-eraser" @click="cutFillers">
          Cut the filler words ({{ fillers.length }})
        </UButton>
      </div>
      <ol class="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-gray-200 p-1 dark:border-gray-800">
        <li
          v-for="row in shown"
          :key="row.index"
          class="flex items-start gap-2 rounded px-1.5 py-1"
          :class="row.index === playingIndex ? 'bg-primary-50 dark:bg-primary-950/40' : ''"
          data-testid="transcript-sentence"
        >
          <button
            type="button"
            class="shrink-0 pt-0.5 text-[11px] tabular-nums text-primary-700 hover:underline dark:text-primary-400"
            :aria-label="`Play from ${formatTimecode(row.s.startMs)}`"
            @click="emit('seek', row.s.startMs)"
          >
            {{ formatTimecode(row.s.startMs) }}
          </button>
          <span v-if="byWord && row.s.words?.length" class="min-w-0 flex-1 text-sm leading-relaxed">
            <button
              v-for="(w, wi) in row.s.words"
              :key="wi"
              type="button"
              class="mr-0.5 rounded px-0.5"
              :class="
                wordCut(w)
                  ? 'text-gray-400 line-through decoration-error-500 dark:text-gray-500'
                  : 'text-gray-900 hover:bg-primary-100 dark:text-white dark:hover:bg-primary-900/40'
              "
              :aria-pressed="wordCut(w)"
              :title="wordCut(w) ? 'Bring this word back' : 'Cut this word out'"
              data-testid="transcript-word"
              @click="cuts = toggleWordCut(w, cuts)"
            >
              {{ w.text }}
            </button>
          </span>
          <button
            v-else
            type="button"
            class="min-w-0 flex-1 text-left text-sm"
            :class="row.cut ? 'text-gray-400 line-through decoration-error-500 dark:text-gray-500' : 'text-gray-900 hover:text-primary-700 dark:text-white'"
            :aria-pressed="row.cut"
            :title="row.cut ? 'Bring this sentence back' : 'Cut this sentence out'"
            @click="toggle(row.index)"
          >
            {{ row.s.text }}
          </button>
        </li>
      </ol>
      <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums" aria-live="polite">
        {{ removedCount }} of {{ sentences.length }} sentences cut · the result is {{ formatTimecode(resultMs) }} long
      </p>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
// Edit by transcript: the video's transcript as a list of sentences; crossing one out adds its stretch
// (and the pause to a crossed-out neighbour) to the Cut out ranges, which render as one Cut job.
import type { Transcript, TranscriptSegment } from '~/composables/useTranscripts'
import { lengthAfterCuts, MAX_CUTS, mergeCutRanges, type CutRange } from '#shared/utils/cutOut'
import { fillerWordCuts, fillerWords, isSentenceCut, toggleSentenceCut, toggleWordCut, type TimedWord } from '#shared/utils/transcriptCuts'
import { formatTimecode } from '#shared/utils/transport'

const cuts = defineModel<CutRange[]>({ required: true })
const props = defineProps<{ videoId: number; videoLanguage: string | null; currentMs: number; durationMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const { list, get } = useTranscripts()
const open = ref(false)
const transcripts = ref<Transcript[]>([])
const transcriptId = ref<number | undefined>()
const sentences = ref<TranscriptSegment[]>([])
const loading = ref(false)
const error = ref('')
const search = ref('')

// Loaded when first opened: the spoken-language transcript, else the first.
watch(
  open,
  async (on) => {
    if (!on || transcripts.value.length || loading.value) return
    loading.value = true
    error.value = ''
    try {
      transcripts.value = (await list({ videoId: props.videoId, size: 50 })).data.filter((t) => t.segmentCount > 0)
      transcriptId.value = (transcripts.value.find((t) => t.language === props.videoLanguage) ?? transcripts.value[0])?.id
    } catch (err) {
      error.value = apiErrorMessage(err)
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)
watch(transcriptId, async (id) => {
  if (!id) return
  loading.value = true
  try {
    sentences.value = ((await get(id)).segments ?? []).slice().sort((a, b) => a.startMs - b.startMs)
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
})

const rows = computed(() => sentences.value.map((s, index) => ({ s, index, cut: isSentenceCut(s, cuts.value) })))
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rows.value.filter((r) => r.s.text.toLowerCase().includes(q)) : rows.value
})
const removedCount = computed(() => rows.value.filter((r) => r.cut).length)
const resultMs = computed(() => lengthAfterCuts(cuts.value, props.durationMs))
const playingIndex = computed(() => sentences.value.findIndex((s) => props.currentMs >= s.startMs && props.currentMs < s.endMs))

// ── By word, when speech-to-text timed the words ──
const hasWords = computed(() => sentences.value.some((s) => s.words?.length))
const byWord = ref(false)
const fillers = computed(() => fillerWords(sentences.value).filter((w) => !wordCut(w)))
function wordCut(w: TimedWord) {
  return isSentenceCut(w, cuts.value)
}
const toast = useToast()
function cutFillers() {
  const { cuts: add, skipped } = fillerWordCuts(fillers.value, cuts.value, props.durationMs)
  cuts.value = mergeCutRanges([...cuts.value, ...add])
  toast.add({
    title: `${add.length} filler word${add.length === 1 ? '' : 's'} cut`,
    description: skipped ? `${skipped} left in — at most ${MAX_CUTS} cuts, and no piece shorter than half a second.` : undefined,
    color: 'success'
  })
}

function toggle(index: number) {
  cuts.value = toggleSentenceCut(sentences.value, index, cuts.value, props.durationMs)
}
</script>
