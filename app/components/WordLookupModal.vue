<template>
  <UModal v-model:open="open" :title="word ? `“${word}”` : 'Look up'" :ui="{ content: 'sm:max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">{{ languageLabel(language) }} →</span>
          <USelect v-model="target" :items="targetOptions" size="sm" class="w-44" aria-label="Translate into" />
        </div>

        <div v-if="loading" class="space-y-2">
          <USkeleton class="h-6 w-1/2" />
          <USkeleton class="h-4 w-full" />
        </div>
        <UAlert v-else-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
        <div v-else-if="result" class="space-y-2">
          <p class="text-xl font-semibold text-gray-900 dark:text-white">
            {{ result.translation }}
            <span v-if="result.partOfSpeech" class="ml-1 text-sm font-normal text-gray-500">{{ result.partOfSpeech }}</span>
          </p>
          <p v-if="result.meaning" class="text-sm text-gray-700 dark:text-gray-300">{{ result.meaning }}</p>
          <p v-if="result.example" class="text-sm italic text-gray-500">“{{ result.example }}”</p>
          <UBadge v-if="result.source === 'glossary'" size="sm" color="info" variant="subtle" icon="i-lucide-book-a">From your organisation's glossary</UBadge>
        </div>

        <p v-if="context" class="border-l-2 border-gray-200 dark:border-gray-700 pl-2 text-xs text-gray-500 whitespace-pre-line">{{ context }}</p>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="open = false">Close</UButton>
          <UButton icon="i-lucide-bookmark-plus" :loading="saving" :disabled="!result || saved" @click="save">
            {{ saved ? 'Saved' : 'Save to my cards' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Looks up a word clicked in a subtitle (glossary → cache → AI on the server)
// and saves it as a flashcard with the line it came from.
import type { WordLookupResult } from '~/composables/useLearn'

const props = defineProps<{
  word: string
  language: string
  context?: string
  videoId?: number
  atMs?: number
  /** Suggested language to translate into (e.g. the second subtitle track's). */
  suggestedTarget?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })

const { lookup } = useLearn()
const { create } = useStudy()
const toast = useToast()

const TARGET_KEY = 'videolingo:lookup-target'
function rememberedTarget() {
  try {
    return localStorage.getItem(TARGET_KEY)
  } catch {
    return null
  }
}
const target = ref<string>('en')
const targetOptions = computed(() =>
  languageOptions(target.value).filter((o): o is { label: string; value: string } => !!o.value && o.value !== props.language)
)
watch(target, (t) => {
  try {
    localStorage.setItem(TARGET_KEY, t)
  } catch {
    // Only a convenience.
  }
})

const result = ref<WordLookupResult | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const saved = ref(false)

async function run() {
  if (!props.word || !target.value) return
  loading.value = true
  error.value = ''
  result.value = null
  saved.value = false
  try {
    result.value = await lookup({ word: props.word, language: props.language, target: target.value, context: props.context, videoId: props.videoId })
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  const preferred = props.suggestedTarget && props.suggestedTarget !== props.language ? props.suggestedTarget : rememberedTarget()
  const fallback = props.language === 'en' ? 'km' : 'en'
  const next = preferred && preferred !== props.language ? preferred : fallback
  if (next !== target.value) target.value = next
  else run()
})
watch(target, () => open.value && run())

async function save() {
  const r = result.value
  if (!r) return
  saving.value = true
  try {
    await create({
      front: r.word,
      back: [r.translation, r.meaning].filter(Boolean).join(' — '),
      language: props.language,
      context: props.context,
      videoId: props.videoId,
      atMs: props.atMs
    })
    saved.value = true
    toast.add({ title: `“${r.word}” saved to your cards`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
