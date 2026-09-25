<template>
  <div>
    <PageHeader
      :title="video?.title ?? 'AI Studio'"
      description="Generate learning material from the transcript, or chat about the video."
      :crumbs="[{ label: 'AI Studio', to: '/ai' }, { label: video?.title ?? '…' }]"
    >
      <template v-if="video" #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-video" :to="`/videos/${video.id}`">Open video</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert">
      <template #actions>
        <UButton size="xs" color="neutral" variant="soft" to="/ai">Back to AI Studio</UButton>
      </template>
    </UAlert>

    <UAlert
      v-if="status && !status.configured"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-plug-zap"
      title="AI isn't configured on the server"
      description="Set ANTHROPIC_API_KEY in the backend's environment and restart it. Existing results can still be viewed."
    />
    <UAlert
      v-else-if="status && !status.enabled"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-power-off"
      title="AI features are turned off"
      description="An admin switched them off under Settings › AI. Existing results can still be viewed."
    />
    <UAlert
      v-else-if="status?.budgetExceeded"
      :color="status.budgetEnforced ? 'error' : 'warning'"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-wallet"
      :title="status.budgetEnforced ? 'Monthly AI budget used up' : 'Over this month’s AI budget'"
      :description="`${formatUsd(status.monthSpendUsd)} spent of ${formatUsd(status.monthlyBudgetUsd)}.${status.budgetEnforced ? ' New requests are blocked until next month.' : ''}`"
    />

    <DetailSkeleton v-if="loading && !video" :fields="4" :lines="false" />

    <template v-else-if="video">
      <UAlert
        v-if="!transcripts.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-captions-off"
        title="This video has no transcript yet"
        description="AI features work from the transcript. Create or import one first."
      >
        <template #actions>
          <UButton size="xs" color="neutral" variant="soft" :to="`/transcripts?videoId=${video.id}`">Transcripts</UButton>
        </template>
      </UAlert>

      <template v-else>
        <UCard class="mb-4">
          <div class="flex flex-wrap items-end gap-4">
            <UFormField label="Transcript" description="What the AI reads">
              <USelect v-model="transcriptId" :items="transcriptOptions" class="w-64" aria-label="Transcript" />
            </UFormField>
            <UFormField label="Write results in" description="Any enabled language">
              <USelectMenu
                v-model="outputLanguage"
                :items="outputLanguageOptions"
                value-key="value"
                class="w-56"
                :search-input="{ placeholder: 'Search languages…' }"
                aria-label="Output language"
              />
            </UFormField>
            <UTabs v-model="tab" :items="tabItems" :content="false" class="ml-auto w-full sm:w-72" />
          </div>
        </UCard>

        <div v-if="tab === 'generate'" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <UCard v-for="task in AI_TASKS" :key="task.value" :ui="{ body: 'space-y-3' }">
            <template #header>
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5 min-w-0">
                  <span class="rounded-lg p-2 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 shrink-0">
                    <UIcon :name="task.icon" class="w-4 h-4 block" />
                  </span>
                  <div class="min-w-0">
                    <h2 class="font-semibold text-gray-900 dark:text-white">{{ task.label }}</h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ task.description }}</p>
                    <UBadge v-if="!featureOn(task.value)" color="neutral" variant="subtle" size="sm" icon="i-lucide-power-off" class="mt-1"
                      >Off in Settings</UBadge
                    >
                    <UTooltip v-else-if="estimates[task.value]" :text="estimateBasis(estimates[task.value]!)">
                      <p class="mt-1 text-xs tabular-nums" :class="estimates[task.value]!.wouldExceedBudget ? 'text-warning-600 dark:text-warning-400' : 'text-gray-500'">
                        <UIcon name="i-lucide-coins" class="w-3 h-3 align-[-2px]" />
                        ≈ {{ estimates[task.value]!.costUsd !== null ? formatUsd(estimates[task.value]!.costUsd) : 'unpriced model' }} ·
                        {{ formatTokens(estimates[task.value]!.inputTokens) }} in / {{ formatTokens(estimates[task.value]!.outputTokens) }} out
                        <template v-if="estimates[task.value]!.wouldExceedBudget"> · over this month's budget</template>
                      </p>
                    </UTooltip>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <UInputNumber
                    v-if="task.defaultCount !== null"
                    v-model="counts[task.value]"
                    :min="1"
                    :max="20"
                    size="sm"
                    class="w-24"
                    :aria-label="`Number of ${task.label.toLowerCase()}`"
                  />
                  <UButton
                    size="sm"
                    :icon="resultFor(task.value) ? 'i-lucide-refresh-cw' : 'i-lucide-sparkles'"
                    :loading="running[task.value]"
                    :disabled="!canGenerate || !featureOn(task.value)"
                    @click="generate(task.value)"
                  >
                    {{ resultFor(task.value) ? 'Regenerate' : 'Generate' }}
                  </UButton>
                </div>
              </div>
            </template>

            <template v-if="resultFor(task.value)">
              <UAlert
                v-if="resultFor(task.value)!.warnings.length"
                color="warning"
                variant="soft"
                icon="i-lucide-wand-sparkles"
                title="Adjusted automatically"
                :description="resultFor(task.value)!.warnings.join(' · ')"
                :ui="{ title: 'text-xs', description: 'text-xs' }"
              />
              <AiResultView :generation="resultFor(task.value)!" />
              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                <div class="space-y-0.5">
                  <AiUsageLine :usage="resultFor(task.value)!.usage" />
                  <p class="text-xs text-gray-400" :title="formatDateTime(resultFor(task.value)!.createdAt)">
                    {{ formatRelativeTime(resultFor(task.value)!.createdAt) }} by {{ resultFor(task.value)!.createdBy ?? '—' }}
                    <template v-if="resultFor(task.value)!.transcriptLanguage">
                      · from the {{ languageLabel(resultFor(task.value)!.transcriptLanguage) }} transcript
                    </template>
                  </p>
                </div>
                <UButton
                  v-if="canWrite"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Delete ${task.label.toLowerCase()} result`"
                  @click="toDelete = resultFor(task.value) ?? null"
                />
              </div>
            </template>
            <div v-else-if="running[task.value]" class="space-y-2">
              <USkeleton class="h-4 w-3/4" />
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-4 w-5/6" />
              <p class="text-xs text-gray-500">Reading the transcript — this can take up to a minute.</p>
            </div>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">
              Nothing generated in {{ languageLabel(outputLanguage) }} yet.
              <template v-if="otherLanguages(task.value).length">
                Available in:
                <UButton
                  v-for="code in otherLanguages(task.value)"
                  :key="code"
                  size="xs"
                  variant="link"
                  :padded="false"
                  class="ml-1"
                  @click="outputLanguage = code"
                >
                  {{ languageLabel(code) }}
                </UButton>
              </template>
            </p>
          </UCard>
        </div>

        <AiChatPanel
          v-else
          :video-id="video.id"
          :transcript-id="transcriptId"
          :ready="!!status?.configured && status.enabled && featureOn('CHAT')"
          :not-ready-reason="status && (!status.enabled || !featureOn('CHAT')) ? 'AI chat is turned off in Settings' : undefined"
          :max-chars="status?.maxChatMessageChars ?? 4000"
        />
      </template>
    </template>

    <ConfirmModal
      :model-value="!!toDelete"
      title="Delete this result?"
      :description="`The ${aiFeatureLabel(toDelete?.type).toLowerCase()} in ${languageLabel(toDelete?.outputLanguage)} will be deleted. Its usage record is kept for cost tracking.`"
      confirm-label="Delete"
      color="error"
      :loading="deleting"
      @update:model-value="(v: boolean) => !v && !deleting && (toDelete = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { AiTaskType } from '#shared/utils/ai'
import type { AiEstimate, AiGeneration, AiStatus } from '~/composables/useAi'
import type { Transcript } from '~/composables/useTranscripts'
import type { Video } from '~/composables/useVideos'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()
const ai = useAi()
const videos = useVideos()
const transcriptsApi = useTranscripts()
const toast = useToast()
const { can } = useAuth()

const videoId = computed(() => Number(route.params.id))
const canWrite = computed(() => can('ai', 'WRITE'))

const video = ref<Video | null>(null)
const transcripts = ref<Transcript[]>([])
const status = ref<AiStatus | null>(null)
const generations = ref<AiGeneration[]>([])
const loading = ref(true)
const error = ref('')

const transcriptId = ref<number | undefined>()
const outputLanguage = ref<string | undefined>()
const tab = ref<'generate' | 'chat'>(route.query.tab === 'chat' ? 'chat' : 'generate')
const tabItems: TabsItem[] = [
  { label: 'Generate', value: 'generate', icon: 'i-lucide-sparkles' },
  { label: 'Chat', value: 'chat', icon: 'i-lucide-messages-square' }
]
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t === 'chat' ? 'chat' : undefined } }))

const counts = reactive<Record<string, number>>(Object.fromEntries(AI_TASKS.filter((t) => t.defaultCount !== null).map((t) => [t.value, t.defaultCount!])))
const running = reactive<Record<string, boolean>>({})
const toDelete = ref<AiGeneration | null>(null)
const deleting = ref(false)

const canGenerate = computed(
  () => canWrite.value && !!status.value?.configured && status.value.enabled && !(status.value.budgetEnforced && status.value.budgetExceeded)
)
// Settings › AI can switch single features off.
function featureOn(type: string) {
  return status.value?.features?.[type] !== false
}

const transcriptOptions = computed(() =>
  transcripts.value.map((t) => ({
    label: `${languageLabel(t.language)}${t.language === t.videoLanguage ? ' (spoken)' : ''} · ${t.segmentCount} segments`,
    value: t.id
  }))
)
const outputLanguageOptions = computed(() => languageOptions(outputLanguage.value))

// Spoken-language transcript first — that's what the server defaults to as well.
function pickDefaultTranscript(list: Transcript[]): Transcript | undefined {
  return list.find((t) => t.language === t.videoLanguage && t.segmentCount > 0) ?? [...list].sort((a, b) => b.segmentCount - a.segmentCount)[0]
}

watch(transcriptId, (id, old) => {
  // Follow the transcript's language unless the user already picked a different one.
  const prev = transcripts.value.find((t) => t.id === old)
  const next = transcripts.value.find((t) => t.id === id)
  if (next && (!outputLanguage.value || outputLanguage.value === prev?.language)) outputLanguage.value = next.language
})

function resultFor(type: AiTaskType): AiGeneration | undefined {
  return generations.value.find((g) => g.type === type && g.outputLanguage === outputLanguage.value)
}

function otherLanguages(type: AiTaskType): string[] {
  return generations.value.filter((g) => g.type === type && g.outputLanguage !== outputLanguage.value).map((g) => g.outputLanguage)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [v, t, s, g] = await Promise.all([
      videos.get(videoId.value),
      transcriptsApi.list({ videoId: videoId.value, size: 50 }),
      ai.status(),
      ai.latest(videoId.value)
    ])
    video.value = v
    transcripts.value = t.data.filter((x) => x.segmentCount > 0)
    status.value = s
    // Default counts come from Settings › AI.
    for (const [type, n] of Object.entries(s.defaultCounts ?? {})) counts[type] = n
    generations.value = g
    const def = pickDefaultTranscript(transcripts.value)
    transcriptId.value = def?.id
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

// ── Cost estimates (per task, for the chosen transcript and count) ──────────
const estimates = reactive<Partial<Record<AiTaskType, AiEstimate>>>({})
let estimateTimer: ReturnType<typeof setTimeout> | undefined
function refreshEstimates() {
  clearTimeout(estimateTimer)
  estimateTimer = setTimeout(async () => {
    if (!transcriptId.value) return
    const tid = transcriptId.value
    await Promise.all(
      AI_TASKS.map(async (task) => {
        try {
          const e = await ai.estimate(videoId.value, { type: task.value, transcriptId: tid, count: task.defaultCount !== null ? counts[task.value] : null })
          if (transcriptId.value === tid) estimates[task.value] = e
        } catch {
          delete estimates[task.value]
        }
      })
    )
  }, 400)
}
watch([transcriptId, () => ({ ...counts })], refreshEstimates)

function estimateBasis(e: AiEstimate) {
  const input = e.inputMeasured ? 'input measured from an earlier run on this transcript' : 'input estimated from the transcript’s length'
  const output = e.outputSamples ? `output averaged over the last ${e.outputSamples} run(s)` : 'a typical output size (no runs yet)'
  const budget =
    e.monthlyBudgetUsd !== null
      ? ` Spent ${formatUsd(e.monthSpendUsd)} of ${formatUsd(e.monthlyBudgetUsd)} this month${e.budgetEnforced && e.wouldExceedBudget ? ' — the budget is enforced, so this will be refused' : ''}.`
      : ''
  return `Estimate on ${e.model}: ${input}; ${output}. Assumes the transcript isn't cached yet, so a repeat within 5 minutes costs less.${budget}`
}

async function generate(type: AiTaskType) {
  running[type] = true
  const meta = AI_TASKS.find((t) => t.value === type)!
  try {
    const result = await ai.generate(videoId.value, {
      type,
      transcriptId: transcriptId.value,
      outputLanguage: outputLanguage.value,
      count: meta.defaultCount !== null ? counts[type] : undefined
    })
    generations.value = [result, ...generations.value.filter((g) => !(g.type === result.type && g.outputLanguage === result.outputLanguage))]
    toast.add({ title: `${meta.label} ready`, description: result.usage ? `Cost ${formatUsd(result.usage.costUsd)}` : undefined, color: 'success' })
    refreshStatus()
    refreshEstimates()
  } catch (err) {
    toast.add({ title: `Could not generate ${meta.label.toLowerCase()}`, description: apiErrorMessage(err), color: 'error' })
    refreshStatus()
  } finally {
    running[type] = false
  }
}

async function refreshStatus() {
  try {
    status.value = await ai.status()
  } catch {
    // Keep the last known status; the next action will surface any real error.
  }
}

async function confirmDelete() {
  const g = toDelete.value
  if (!g) return
  deleting.value = true
  try {
    await ai.removeGeneration(g.id)
    // Show the previous result for that slot, if there is one.
    generations.value = await ai.latest(videoId.value)
    toDelete.value = null
    toast.add({ title: 'Result deleted', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not delete', description: apiErrorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>
