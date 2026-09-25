<template>
  <div class="text-sm">
    <!-- Summary -->
    <div v-if="summary" class="space-y-3">
      <p class="font-medium text-gray-900 dark:text-white">{{ summary.tldr }}</p>
      <p v-for="(p, i) in paragraphs(summary.summary)" :key="i" class="text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ p }}</p>
      <div class="flex flex-wrap items-center gap-1.5">
        <UBadge v-if="summary.estimatedLevel" color="primary" variant="solid" size="sm" :title="'Estimated CEFR level'">
          CEFR {{ summary.estimatedLevel }}
        </UBadge>
        <UBadge v-for="t in summary.topics ?? []" :key="t" color="neutral" variant="subtle" size="sm">{{ t }}</UBadge>
      </div>
    </div>

    <!-- Chapters -->
    <ol v-else-if="chapters" class="space-y-2">
      <li v-for="(c, i) in chapters.chapters" :key="i" class="flex gap-3">
        <span class="font-mono text-xs text-primary-600 dark:text-primary-400 w-12 shrink-0 pt-0.5 tabular-nums">{{ formatDuration(c.startSeconds) }}</span>
        <div class="min-w-0">
          <p class="font-medium text-gray-900 dark:text-white">{{ c.title }}</p>
          <p v-if="c.summary" class="text-gray-600 dark:text-gray-400">{{ c.summary }}</p>
        </div>
      </li>
    </ol>

    <!-- Key points -->
    <ol v-else-if="keyPoints" class="space-y-2.5">
      <li v-for="(k, i) in keyPoints.keyPoints" :key="i" class="flex gap-3">
        <span
          class="flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold shrink-0"
        >
          {{ i + 1 }}
        </span>
        <div class="min-w-0">
          <p class="font-medium text-gray-900 dark:text-white">
            {{ k.point }}
            <span class="font-mono text-xs font-normal text-gray-400 ml-1 tabular-nums">{{ formatDuration(k.timestampSeconds) }}</span>
          </p>
          <p v-if="k.explanation" class="text-gray-600 dark:text-gray-400">{{ k.explanation }}</p>
        </div>
      </li>
    </ol>

    <!-- Questions: answers hidden until revealed, so they work as self-check -->
    <ol v-else-if="questions" class="space-y-3">
      <li v-for="(q, i) in questions.questions" :key="i" class="rounded-md border border-gray-200 dark:border-gray-800 p-3">
        <div class="flex items-start justify-between gap-2">
          <p class="font-medium text-gray-900 dark:text-white">{{ i + 1 }}. {{ q.question }}</p>
          <UBadge :color="difficultyColor(q.difficulty)" variant="subtle" size="sm" class="shrink-0">{{ formatEnum(q.difficulty) }}</UBadge>
        </div>
        <div v-if="revealed.has(i)" class="mt-2 text-gray-700 dark:text-gray-300">
          {{ q.answer }}
          <span class="font-mono text-xs text-gray-400 ml-1 tabular-nums">{{ formatDuration(q.timestampSeconds) }}</span>
        </div>
        <UButton v-else size="xs" color="neutral" variant="link" :padded="false" class="mt-1" icon="i-lucide-eye" @click="reveal(i)">Show answer</UButton>
      </li>
    </ol>

    <!-- Quiz: pick an option to check it -->
    <div v-else-if="quiz" class="space-y-4">
      <div v-for="(q, i) in quiz.questions" :key="i">
        <p class="font-medium text-gray-900 dark:text-white mb-1.5">{{ i + 1 }}. {{ q.question }}</p>
        <div class="grid gap-1.5">
          <button
            v-for="(opt, j) in q.options"
            :key="j"
            type="button"
            class="text-left rounded-md border px-3 py-1.5 transition-colors flex items-center gap-2"
            :class="optionClass(i, j, q.correctOptionIndex)"
            :disabled="answers[i] !== undefined"
            :aria-pressed="answers[i] === j"
            @click="answers[i] = j"
          >
            <span class="font-mono text-xs text-gray-400 w-4">{{ String.fromCharCode(65 + j) }}</span>
            <span class="flex-1">{{ opt }}</span>
            <UIcon v-if="answers[i] !== undefined && j === q.correctOptionIndex" name="i-lucide-check" class="w-4 h-4 text-success-600" />
            <UIcon v-else-if="answers[i] === j" name="i-lucide-x" class="w-4 h-4 text-error-600" />
          </button>
        </div>
        <p v-if="answers[i] !== undefined" class="mt-1.5 text-gray-600 dark:text-gray-400">
          <span
            :class="answers[i] === q.correctOptionIndex ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'"
            class="font-medium"
          >
            {{ answers[i] === q.correctOptionIndex ? 'Correct.' : 'Not quite.' }}
          </span>
          {{ q.explanation }}
          <span class="font-mono text-xs text-gray-400 tabular-nums">{{ formatDuration(q.timestampSeconds) }}</span>
        </p>
      </div>
      <div class="flex items-center justify-between rounded-md bg-gray-50 dark:bg-gray-900 px-3 py-2">
        <span class="text-gray-700 dark:text-gray-300">
          Score: <strong>{{ score }}</strong> / {{ quiz.questions.length }}
          <span v-if="answeredCount < quiz.questions.length" class="text-gray-400">({{ answeredCount }} answered)</span>
        </span>
        <UButton v-if="answeredCount" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="resetQuiz">Retry</UButton>
      </div>
    </div>

    <p v-else class="text-gray-500">This result has no content.</p>
  </div>
</template>

<script setup lang="ts">
import type { AiGeneration, ChaptersContent, KeyPointsContent, QuestionsContent, QuizContent, SummaryContent } from '~/composables/useAi'

// Only `type` and `content` are read, so learner study material (useLearn's StudyItem) renders here too.
const props = defineProps<{ generation: Pick<AiGeneration, 'type' | 'content'> }>()

// Only render a result whose content has the expected shape — a malformed or
// older stored result falls through to "no content" instead of crashing.
const content = computed(() => (props.generation.content ?? {}) as Record<string, unknown>)
const hasList = (key: string) => Array.isArray(content.value[key])
const summary = computed(() =>
  props.generation.type === 'SUMMARY' && typeof content.value.tldr === 'string' ? (content.value as unknown as SummaryContent) : null
)
const chapters = computed(() => (props.generation.type === 'CHAPTERS' && hasList('chapters') ? (content.value as unknown as ChaptersContent) : null))
const keyPoints = computed(() => (props.generation.type === 'KEY_POINTS' && hasList('keyPoints') ? (content.value as unknown as KeyPointsContent) : null))
const questions = computed(() => (props.generation.type === 'QUESTIONS' && hasList('questions') ? (content.value as unknown as QuestionsContent) : null))
const quiz = computed(() => (props.generation.type === 'QUIZ' && hasList('questions') ? (content.value as unknown as QuizContent) : null))

const revealed = ref(new Set<number>())
const answers = ref<Record<number, number>>({})

// A new result (regenerate / different language) starts fresh.
watch(
  () => props.generation,
  () => {
    revealed.value = new Set()
    answers.value = {}
  }
)

function reveal(i: number) {
  revealed.value = new Set(revealed.value).add(i)
}

function resetQuiz() {
  answers.value = {}
}

const answeredCount = computed(() => Object.keys(answers.value).length)
const score = computed(() => quiz.value?.questions.filter((q, i) => answers.value[i] === q.correctOptionIndex).length ?? 0)

function optionClass(i: number, j: number, correct: number) {
  const picked = answers.value[i]
  if (picked === undefined)
    return 'border-gray-200 dark:border-gray-800 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 cursor-pointer'
  if (j === correct) return 'border-success-400 bg-success-50 dark:bg-success-950/30'
  if (j === picked) return 'border-error-400 bg-error-50 dark:bg-error-950/30'
  return 'border-gray-200 dark:border-gray-800 opacity-60'
}

function difficultyColor(d: string): 'success' | 'warning' | 'error' | 'neutral' {
  return d === 'EASY' ? 'success' : d === 'HARD' ? 'error' : d === 'MEDIUM' ? 'warning' : 'neutral'
}
</script>
