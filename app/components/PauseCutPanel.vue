<template>
  <EditorSection v-model:open="open" title="Remove the pauses" :hint="found ? `${found.length} found` : ''" data-testid="pause-cut">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Finds the quiet stretches in the sound and cuts the long ones out, keeping a little quiet next to the speech. They are added under Cut out, where you can
      check or change each one.
    </p>
    <div class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="noiseDb"
        :items="PAUSE_LEVELS.map((l) => ({ label: l.label, value: l.value }))"
        size="xs"
        class="w-48"
        aria-label="How quiet a pause is"
      />
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-audio-waveform" :loading="finding" @click="find">
        {{ found ? 'Find again' : 'Find the pauses' }}
      </UButton>
    </div>
    <p v-if="error" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
    <template v-if="found">
      <SliderRow v-model="minPauseMs" label="Cut pauses longer than" :min="300" :max="3000" :step="100" :default-value="1000" unit=" ms" />
      <SliderRow v-model="keepMs" label="Keep next to the speech" :min="0" :max="500" :step="50" :default-value="200" unit=" ms" />
      <!-- What would go, over the whole video -->
      <div v-if="durationMs" class="relative h-2 overflow-hidden rounded-full bg-primary-500/30" role="img" :aria-label="`${plan.cuts.length} pauses to cut`">
        <span
          v-for="(c, i) in plan.cuts"
          :key="i"
          class="absolute inset-y-0 bg-error-500"
          :style="{ left: `${(c.startMs / durationMs) * 100}%`, width: `${((c.endMs - c.startMs) / durationMs) * 100}%` }"
        />
      </div>
      <p class="text-xs text-gray-600 dark:text-gray-300 tabular-nums" aria-live="polite" data-testid="pause-summary">
        <template v-if="plan.cuts.length">
          {{ plan.cuts.length }} pause{{ plan.cuts.length === 1 ? '' : 's' }} to cut, saving {{ formatTimecode(plan.savedMs) }}.
        </template>
        <template v-else>No pause is that long.</template>
        <template v-if="plan.skipped"> {{ plan.skipped }} more left in (at most {{ MAX_CUTS }} cuts, and no piece shorter than half a second).</template>
      </p>
      <UButton size="xs" color="neutral" :class="TAB_ACCENTS.trim.button" icon="i-lucide-scissors" :disabled="!plan.cuts.length" @click="apply">
        Cut {{ plan.cuts.length || '' }} pause{{ plan.cuts.length === 1 ? '' : 's' }}
      </UButton>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
// Remove the pauses: asks the backend where the sound is quiet (VideoEditService.pauses), then turns the long
// pauses into Cut out ranges (pausesToCuts), which render as one Cut job.
import { MAX_CUTS, mergeCutRanges, type CutRange } from '#shared/utils/cutOut'
import { PAUSE_LEVELS, pausesToCuts } from '#shared/utils/pauseCuts'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { formatTimecode } from '#shared/utils/transport'

const cuts = defineModel<CutRange[]>({ required: true })
const props = defineProps<{ videoId: number; durationMs: number }>()

const { pauses } = useVideoEdits()
const toast = useToast()
const open = ref(false)
const noiseDb = ref<(typeof PAUSE_LEVELS)[number]['value']>(PAUSE_LEVELS[0].value)
const finding = ref(false)
const error = ref('')
const found = ref<CutRange[] | null>(null)
const minPauseMs = ref(1000)
const keepMs = ref(200)

watch(noiseDb, () => (found.value = null))

async function find() {
  finding.value = true
  error.value = ''
  try {
    found.value = (await pauses(props.videoId, noiseDb.value)).pauses
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    finding.value = false
  }
}

const plan = computed(() => pausesToCuts(found.value ?? [], cuts.value, { minPauseMs: minPauseMs.value, keepMs: keepMs.value, durationMs: props.durationMs }))

function apply() {
  const n = plan.value.cuts.length
  cuts.value = mergeCutRanges([...cuts.value, ...plan.value.cuts])
  toast.add({ title: `${n} pause${n === 1 ? '' : 's'} added to Cut out`, description: 'Check them there, then start the cut.', color: 'success' })
}
</script>
