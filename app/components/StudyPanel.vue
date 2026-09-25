<template>
  <UCard v-if="tabs.length">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UTabs v-model="tab" :items="tabs" :content="false" size="sm" />
        <div class="flex items-center gap-2">
          <USelect
            v-if="languages.length > 1"
            v-model="language"
            :items="languages.map((l) => ({ label: languageLabel(l), value: l }))"
            size="sm"
            class="w-36"
          />
          <UButton
            v-if="current?.type === 'KEY_POINTS'"
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-layers"
            :loading="adding"
            @click="addKeyPoints"
          >
            Add to my cards
          </UButton>
        </div>
      </div>
    </template>
    <QuizRunner
      v-if="current?.type === 'QUIZ'"
      :generation-id="current.generationId"
      :video-id="videoId"
      :content="current.content"
      @seek="(ms) => emit('seek', ms)"
    />
    <AiResultView v-else-if="current" :generation="current" />
  </UCard>
</template>

<script setup lang="ts">
// The AI study material for a video, learner-facing: summary, chapters, key
// points (which can become flashcards) and a quiz to take.
import type { StudyItem, StudyType } from '~/composables/useLearn'

const props = defineProps<{ videoId: number; items: StudyItem[]; preferredLanguage?: string | null }>()
const emit = defineEmits<{ seek: [ms: number] }>()

const { fromKeyPoints } = useStudy()
const toast = useToast()

const ORDER: { type: StudyType; label: string; icon: string }[] = [
  { type: 'SUMMARY', label: 'Summary', icon: 'i-lucide-file-text' },
  { type: 'KEY_POINTS', label: 'Key points', icon: 'i-lucide-list-checks' },
  { type: 'CHAPTERS', label: 'Chapters', icon: 'i-lucide-list-video' },
  { type: 'QUIZ', label: 'Quiz', icon: 'i-lucide-circle-help' }
]

const languages = computed(() => [...new Set(props.items.map((i) => i.outputLanguage))])
const language = ref<string | undefined>()
watch(
  () => [props.items, props.preferredLanguage] as const,
  () => {
    const want = props.preferredLanguage && languages.value.includes(props.preferredLanguage) ? props.preferredLanguage : languages.value[0]
    if (!language.value || !languages.value.includes(language.value)) language.value = want
  },
  { immediate: true }
)

const inLanguage = computed(() => props.items.filter((i) => i.outputLanguage === language.value))
const tabs = computed(() => ORDER.filter((o) => inLanguage.value.some((i) => i.type === o.type)).map((o) => ({ label: o.label, icon: o.icon, value: o.type })))
const tab = ref<StudyType>('SUMMARY')
watch(
  tabs,
  (t) => {
    if (t.length && !t.some((x) => x.value === tab.value)) tab.value = t[0]!.value
  },
  { immediate: true }
)
const current = computed(() => inLanguage.value.find((i) => i.type === tab.value) ?? null)

const adding = ref(false)
async function addKeyPoints() {
  if (!current.value) return
  adding.value = true
  try {
    const n = await fromKeyPoints(current.value.generationId)
    toast.add({ title: n ? `Added ${n} card(s)` : 'They’re all in your cards already', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not add them', description: apiErrorMessage(err), color: 'error' })
  } finally {
    adding.value = false
  }
}
</script>
