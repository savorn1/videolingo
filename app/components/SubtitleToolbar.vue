<template>
  <div class="flex flex-wrap items-center gap-2">
    <USelect v-model="trackId" :items="trackOptions" size="sm" class="w-40" aria-label="Subtitles (S)" :disabled="!hasTracks" />
    <USelect v-model="secondId" :items="secondOptions" size="sm" class="w-40" aria-label="Second language (T)" :disabled="trackCount < 2" />

    <!-- Everything else — practice mode, caption style, timing, reporting a
         problem — is occasional, so it's tucked behind one button instead of
         spreading five more controls across the bar. The dot says there's a
         non-default setting in here worth knowing about. -->
    <UPopover>
      <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-sliders-horizontal" :disabled="!hasTracks" class="relative">
        More
        <span v-if="hasCustomizations" class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden="true" />
      </UButton>
      <template #content>
        <div class="w-72 max-h-[70vh] overflow-y-auto space-y-3 p-3 text-sm">
          <UFormField label="Practice mode">
            <USelect v-model="practice" :items="PRACTICE" size="sm" class="w-full" />
          </UFormField>

          <USeparator label="Caption style" />
          <UFormField label="Size">
            <UFieldGroup size="xs" class="w-full">
              <UButton
                v-for="s in SIZES"
                :key="s.value"
                :color="prefs.captionStyle.size === s.value ? 'primary' : 'neutral'"
                variant="soft"
                class="flex-1 justify-center"
                @click="setStyle({ size: s.value })"
              >
                {{ s.label }}
              </UButton>
            </UFieldGroup>
          </UFormField>
          <UFormField :label="`Background ${prefs.captionStyle.background}%`">
            <USlider
              :model-value="prefs.captionStyle.background"
              :min="0"
              :max="100"
              :step="10"
              @update:model-value="(v) => setStyle({ background: Number(v) })"
            />
          </UFormField>
          <UFormField label="Font">
            <USelect
              :model-value="prefs.captionStyle.font"
              :items="FONTS"
              size="sm"
              class="w-full"
              @update:model-value="(v) => setStyle({ font: v as CaptionFont })"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Position">
              <USelect
                :model-value="prefs.captionStyle.position"
                :items="POSITIONS"
                size="sm"
                @update:model-value="(v) => setStyle({ position: v as 'top' | 'bottom' })"
              />
            </UFormField>
            <UFormField label="2nd language">
              <USelect
                :model-value="prefs.captionStyle.secondary"
                :items="SECONDARY"
                size="sm"
                @update:model-value="(v) => setStyle({ secondary: v as 'above' | 'below' })"
              />
            </UFormField>
          </div>
          <USwitch :model-value="prefs.hoverPause" label="Pause when pointing at captions" @update:model-value="(v) => update({ hoverPause: v })" />
          <USwitch
            :model-value="prefs.wordHighlight"
            label="Highlight each word as it's said"
            description="Estimated from the line's timing."
            @update:model-value="(v) => update({ wordHighlight: v })"
          />
          <USwitch :model-value="prefs.glossaryHighlight" label="Underline glossary terms" @update:model-value="(v) => update({ glossaryHighlight: v })" />
          <UButton size="xs" color="neutral" variant="link" :padded="false" @click="setStyle({ ...DEFAULT_CAPTION_STYLE })">Reset style</UButton>

          <USeparator label="Timing" />
          <div class="flex items-center justify-center gap-1">
            <UTooltip text="Show subtitles earlier">
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-minus" aria-label="Subtitles earlier" @click="emit('nudge', -step)" />
            </UTooltip>
            <UTooltip :text="offsetMs ? 'Timing corrected for this video — click to reset' : 'No correction on this video'">
              <UButton
                size="sm"
                :color="offsetMs ? 'warning' : 'neutral'"
                variant="soft"
                class="tabular-nums min-w-20 justify-center"
                @click="emit('resetOffset')"
              >
                {{ offsetMs ? `${offsetMs > 0 ? '+' : ''}${(offsetMs / 1000).toFixed(2)}s` : 'In sync' }}
              </UButton>
            </UTooltip>
            <UTooltip text="Show subtitles later">
              <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-plus" aria-label="Subtitles later" @click="emit('nudge', step)" />
            </UTooltip>
          </div>

          <!-- Page-specific extras (e.g. voice-over, keyboard shortcuts) land here too. -->
          <slot name="extra" />

          <USeparator />
          <UButton block color="neutral" variant="soft" icon="i-lucide-flag" :disabled="!trackId" @click="openReport">Report a subtitle problem</UButton>
        </div>
      </template>
    </UPopover>

    <UModal
      v-model:open="showReport"
      title="Report a subtitle problem"
      :description="primaryLabel ? `About “${primaryLabel}”, at ${formatTimestamp(currentMs)}` : undefined"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <form class="space-y-4" @submit.prevent="submitReport">
          <URadioGroup v-model="report.kind" :items="PROBLEMS" />
          <UFormField label="Details" hint="optional">
            <UTextarea v-model="report.note" :rows="3" maxlength="1000" class="w-full" placeholder="e.g. “bank” should be “river bank” here" />
          </UFormField>
          <p v-if="report.kind === 'TIMING' && offsetMs" class="text-xs text-gray-500">
            Your correction ({{ (offsetMs / 1000).toFixed(2) }} s) is included, so the team can fix it for everyone.
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showReport = false">Cancel</UButton>
            <UButton type="submit" icon="i-lucide-send" :loading="sending">Send</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// The subtitle controls under a learner player. Only the track pickers stay
// on the bar itself — practice mode, caption style, timing correction and
// reporting a problem are occasional, so they share one "More" popover
// (see the `extra` slot for page-specific additions to it).
import type { CaptionFont, PracticeMode } from '~/composables/useLearnerPrefs'

const props = defineProps<{
  trackOptions: { label: string; value: number }[]
  secondOptions: { label: string; value: number }[]
  offsetMs: number
  step: number
  currentMs: number
  primaryLabel?: string | null
}>()
const emit = defineEmits<{ nudge: [number]; resetOffset: [] }>()
const trackId = defineModel<number>('trackId', { required: true })
const secondId = defineModel<number>('secondId', { required: true })

const { prefs, update, setStyle } = useLearnerPrefs()
const { reportProblem } = useLearn()
const toast = useToast()

const trackCount = computed(() => props.trackOptions.length - 1)
const hasTracks = computed(() => trackCount.value > 0)
const practice = computed({ get: () => prefs.value.practice, set: (v: PracticeMode) => update({ practice: v }) })
// Whether there's a non-default setting worth the learner knowing is tucked away.
const hasCustomizations = computed(() => props.offsetMs !== 0 || prefs.value.practice !== 'normal')

const PRACTICE: { label: string; value: PracticeMode }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Hidden until hover', value: 'hover' },
  { label: 'Reveal after each line', value: 'reveal' },
  { label: 'Translation only', value: 'translation' }
]
const SIZES = [
  { label: 'S', value: 's' as const },
  { label: 'M', value: 'm' as const },
  { label: 'L', value: 'l' as const },
  { label: 'XL', value: 'xl' as const }
]
const FONTS = [
  { label: 'Sans', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Rounded', value: 'rounded' }
]
const POSITIONS = [
  { label: 'Bottom', value: 'bottom' },
  { label: 'Top', value: 'top' }
]
const SECONDARY = [
  { label: 'Above', value: 'above' },
  { label: 'Below', value: 'below' }
]
const PROBLEMS = [
  { label: 'Timing is off', value: 'TIMING' },
  { label: 'Wrong or misspelt text', value: 'TEXT' },
  { label: 'Something said isn’t subtitled', value: 'MISSING' },
  { label: 'Something else', value: 'OTHER' }
]

const showReport = ref(false)
const sending = ref(false)
const report = reactive<{ kind: 'TIMING' | 'TEXT' | 'MISSING' | 'OTHER'; note: string }>({ kind: 'TIMING', note: '' })
function openReport() {
  Object.assign(report, { kind: props.offsetMs ? 'TIMING' : 'TEXT', note: '' })
  showReport.value = true
}
async function submitReport() {
  if (!trackId.value) return
  sending.value = true
  try {
    await reportProblem(trackId.value, {
      kind: report.kind,
      note: report.note.trim() || undefined,
      atMs: Math.round(props.currentMs),
      offsetMs: props.offsetMs || undefined
    })
    toast.add({ title: 'Thanks — the team will take a look', color: 'success' })
    showReport.value = false
  } catch (err) {
    toast.add({ title: 'Could not send the report', description: apiErrorMessage(err), color: 'error' })
  } finally {
    sending.value = false
  }
}
</script>
