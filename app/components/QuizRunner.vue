<template>
  <div class="space-y-4 text-sm">
    <div
      v-if="result"
      class="rounded-lg p-4 text-center"
      :class="result.percent >= 70 ? 'bg-success-50 dark:bg-success-950/30' : 'bg-warning-50 dark:bg-warning-950/30'"
    >
      <p class="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{{ result.score }} / {{ result.total }}</p>
      <p class="text-gray-600 dark:text-gray-300">
        {{ result.percent >= 90 ? 'Excellent!' : result.percent >= 70 ? 'Well done.' : 'Keep practising — review the parts you missed.' }}
        <template v-if="result.attemptNumber > 1"> · attempt {{ result.attemptNumber }}</template>
        <template v-if="best !== null"> · best {{ best }}%</template>
      </p>
      <UButton class="mt-3" size="sm" color="neutral" variant="soft" icon="i-lucide-rotate-ccw" @click="retry">Try again</UButton>
    </div>

    <ol class="space-y-5">
      <li v-for="(q, i) in questions" :key="i" class="space-y-2">
        <p class="font-medium text-gray-900 dark:text-white">{{ i + 1 }}. {{ q.question }}</p>
        <div class="space-y-1.5">
          <label v-for="(opt, j) in q.options" :key="j" class="flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors" :class="optionClass(i, j)">
            <input v-model="answers[i]" type="radio" :name="`q-${i}`" :value="j" :disabled="!!result" class="mt-0.5 accent-primary-600" />
            <span>{{ opt }}</span>
          </label>
        </div>
        <div v-if="result" class="text-xs space-y-1">
          <p :class="result.questions[i]!.correct ? 'text-success-700 dark:text-success-400' : 'text-error-700 dark:text-error-400'">
            {{ result.questions[i]!.correct ? 'Correct.' : result.questions[i]!.chosen === null ? 'Skipped.' : 'Not quite.' }}
            {{ result.questions[i]!.explanation }}
          </p>
          <UButton
            size="xs"
            variant="link"
            color="primary"
            icon="i-lucide-play"
            :padded="false"
            @click="emit('seek', result.questions[i]!.timestampSeconds * 1000)"
          >
            Watch that part ({{ formatDuration(result.questions[i]!.timestampSeconds) }})
          </UButton>
        </div>
      </li>
    </ol>

    <div v-if="!result" class="flex items-center justify-between gap-2">
      <span class="text-xs text-gray-500">{{ answered }} of {{ questions.length }} answered</span>
      <UButton icon="i-lucide-check" :loading="submitting" :disabled="!answered" @click="submit">Check my answers</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
// Takes an AI quiz the way a learner would: the questions arrive without
// answers, the server grades the attempt and returns explanations, and each
// attempt is kept (useStudy().quizAttempts).
import type { QuizResult } from '~/composables/useLearn'

const props = defineProps<{ generationId: number; videoId: number; content: Record<string, unknown> }>()
const emit = defineEmits<{ seek: [ms: number]; graded: [QuizResult] }>()

const { submitQuiz } = useLearn()
const { quizAttempts } = useStudy()
const toast = useToast()

const questions = computed(() => (Array.isArray(props.content.questions) ? (props.content.questions as { question: string; options: string[] }[]) : []))
const answers = ref<(number | null)[]>([])
const result = ref<QuizResult | null>(null)
const submitting = ref(false)
const best = ref<number | null>(null)
const answered = computed(() => answers.value.filter((a) => a !== null && a !== undefined).length)

function retry() {
  result.value = null
  answers.value = questions.value.map(() => null)
}

async function submit() {
  submitting.value = true
  try {
    result.value = await submitQuiz(
      props.generationId,
      questions.value.map((_, i) => answers.value[i] ?? null)
    )
    emit('graded', result.value)
    loadBest()
  } catch (err) {
    toast.add({ title: 'Could not check the quiz', description: apiErrorMessage(err), color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function loadBest() {
  try {
    const mine = (await quizAttempts(props.videoId)).filter((a) => a.generationId === props.generationId)
    best.value = mine.length ? Math.max(...mine.map((a) => a.percent)) : null
  } catch {
    best.value = null
  }
}

function optionClass(i: number, j: number) {
  if (!result.value)
    return answers.value[i] === j
      ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
      : 'border-gray-200 dark:border-gray-700 cursor-pointer hover:border-gray-300'
  const q = result.value.questions[i]!
  if (j === q.correctOptionIndex) return 'border-success-400 bg-success-50 dark:bg-success-950/30'
  if (j === q.chosen) return 'border-error-400 bg-error-50 dark:bg-error-950/30'
  return 'border-gray-200 dark:border-gray-700 opacity-70'
}

watch(
  () => props.generationId,
  () => {
    retry()
    loadBest()
  },
  { immediate: true }
)
</script>
