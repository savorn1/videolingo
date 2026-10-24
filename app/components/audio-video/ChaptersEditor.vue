<template>
  <UModal
    v-model:open="open"
    :title="`Chapters — ${name}`"
    description="Each title shows on the picture for a few seconds as its chapter starts, and becomes a chapter marker."
  >
    <template #body>
      <div class="space-y-3" data-testid="chapters-editor">
        <p v-if="!draft.length" class="text-sm text-gray-500 dark:text-gray-400">No chapters yet.</p>
        <ol v-else class="space-y-2">
          <li v-for="(c, i) in draft" :key="c.id" class="flex items-center gap-2">
            <UInput
              :model-value="formatTimecode(c.startMs)"
              size="sm"
              class="w-24 font-mono"
              :aria-label="`Chapter ${i + 1} starts at`"
              @change="(e: Event) => typeStart(c, e)"
            />
            <UInput
              v-model="c.title"
              size="sm"
              class="min-w-0 flex-1"
              :maxlength="MAX_CHAPTER_TITLE"
              :aria-label="`Chapter ${i + 1} title`"
              placeholder="Title"
            />
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="`Remove chapter ${i + 1}`" @click="draft.splice(i, 1)" />
          </li>
        </ol>
        <div class="flex flex-wrap gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-plus" :disabled="draft.length >= MAX_CHAPTERS" @click="add">Add a chapter</UButton>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-clipboard-paste" :aria-expanded="pasting" @click="pasting = !pasting"
            >Paste a list</UButton
          >
        </div>
        <div v-if="pasting" class="space-y-2" data-testid="chapters-paste">
          <UTextarea
            v-model="pasted"
            :rows="5"
            autoresize
            :maxrows="12"
            class="w-full font-mono"
            aria-label="Chapter list"
            placeholder="0:00 Welcome&#10;2:15 Greetings&#10;10:40 Numbers"
          />
          <div class="flex items-center gap-2">
            <p class="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
              One a line, time first or last — as in a YouTube description or show notes.
              <template v-if="parsed.chapters.length"
                >{{ parsed.chapters.length }} found<template v-if="parsed.skipped"
                  >, {{ parsed.skipped }} line{{ parsed.skipped === 1 ? '' : 's' }} without a time left out</template
                >.</template
              >
            </p>
            <UButton size="xs" :disabled="!parsed.chapters.length" @click="usePasted">Use these</UButton>
          </div>
        </div>
        <p v-if="problem" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ problem }}</p>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancel</UButton>
          <UButton :disabled="!!problem" @click="save">Save chapters</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Editing one recording's chapters on the "Video from audio" page: times (typed like 1:23) and titles, or a pasted
// "0:00 Intro" list, checked as the server checks them; saved in time order.
import { chapterProblem, MAX_CHAPTER_TITLE, MAX_CHAPTERS, newChapterStart, parseChapterList, type ChapterMark } from '#shared/utils/audioVideoExtras'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'

const open = defineModel<boolean>('open', { required: true })
const chapters = defineModel<ChapterMark[]>({ required: true })
const props = defineProps<{ name: string; durationMs: number | null }>()

let nextId = 1
const draft = ref<(ChapterMark & { id: number })[]>([])
// A pasted list replaces the chapters in the draft (still checked, and only kept on Save).
const pasting = ref(false)
const pasted = ref('')
const parsed = computed(() => parseChapterList(pasted.value))
function usePasted() {
  draft.value = parsed.value.chapters.map((c) => ({ ...c, id: nextId++ }))
  pasting.value = false
  pasted.value = ''
}
watch(
  open,
  (on) => {
    if (!on) return
    draft.value = chapters.value.map((c) => ({ ...c, id: nextId++ }))
    pasting.value = false
    pasted.value = ''
  },
  { immediate: true }
)
const sorted = computed(() => [...draft.value].sort((a, b) => a.startMs - b.startMs).map(({ startMs, title }) => ({ startMs, title: title.trim() })))
const problem = computed(() => {
  if (props.durationMs && sorted.value.some((c) => c.startMs >= props.durationMs!)) return 'A chapter starts after the recording ends'
  return chapterProblem(sorted.value)
})
const toast = useToast()
function typeStart(c: ChapterMark, e: Event) {
  const input = e.target as HTMLInputElement
  const ms = parseTimecode(input.value)
  if (ms === null) toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
  else c.startMs = ms
  input.value = formatTimecode(c.startMs)
}
function add() {
  draft.value.push({ id: nextId++, startMs: newChapterStart(draft.value, props.durationMs), title: '' })
}
function save() {
  chapters.value = sorted.value
  open.value = false
}
</script>
