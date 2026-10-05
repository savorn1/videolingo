<template>
  <EditorSection v-model:open="open" title="Subtitles" :changed="!!edit.state.captions" :hint="hint" data-testid="captions">
    <p v-if="!source.allowed.value" class="text-xs text-gray-500 dark:text-gray-400">You need access to transcripts to burn in subtitles.</p>
    <template v-else>
      <USwitch
        :model-value="!!edit.state.captions"
        label="Burn in subtitles from a transcript"
        description="Every spoken line, drawn onto the picture at its time."
        @update:model-value="onToggle"
      />
      <template v-if="edit.state.captions">
        <p v-if="source.state.value === 'loading'" class="text-xs text-gray-500 dark:text-gray-400">Reading the transcripts…</p>
        <p v-else-if="source.state.value === 'error'" class="text-xs text-error-600 dark:text-error-400">Couldn't read the transcripts.</p>
        <p v-else-if="!source.transcripts.value.length" class="text-xs text-gray-500 dark:text-gray-400">
          This video has no transcript yet — make one on the Transcripts page first.
        </p>
        <template v-else>
          <UFormField label="Lines from">
            <USelect
              :model-value="edit.state.captions.transcriptId ?? undefined"
              :items="transcriptItems"
              class="w-full"
              aria-label="Transcript for the subtitles"
              @update:model-value="(v) => set({ transcriptId: Number(v) })"
            />
          </UFormField>
          <UFormField label="Second line (translation)" hint="Smaller, under each line">
            <USelect
              :model-value="edit.state.captions.secondTranscriptId ?? NONE"
              :items="secondItems"
              class="w-full"
              aria-label="Second transcript for the subtitles"
              @update:model-value="(v) => set({ secondTranscriptId: v === NONE ? null : Number(v) })"
            />
          </UFormField>
          <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Subtitle style">
            <span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Style</span>
            <UButton
              v-for="st in CAPTION_STYLES"
              :key="st.value"
              size="xs"
              color="neutral"
              role="radio"
              :aria-checked="edit.state.captions.style === st.value"
              :variant="edit.state.captions.style === st.value ? 'soft' : 'ghost'"
              :class="edit.state.captions.style === st.value ? TAB_ACCENTS.overlay.soft : ''"
              @click="set({ style: st.value })"
            >
              {{ st.label }}
            </UButton>
          </div>
          <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Subtitle position">
            <span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Where</span>
            <UButton
              v-for="pos in POSITIONS"
              :key="pos.value"
              size="xs"
              color="neutral"
              role="radio"
              :icon="pos.icon"
              :aria-checked="edit.state.captions.position === pos.value"
              :variant="edit.state.captions.position === pos.value ? 'soft' : 'ghost'"
              :class="edit.state.captions.position === pos.value ? TAB_ACCENTS.overlay.soft : ''"
              @click="set({ position: pos.value })"
            >
              {{ pos.label }}
            </UButton>
          </div>
          <SliderRow
            label="Size"
            :model-value="edit.state.captions.sizePct"
            :min="MIN_CAPTION_PCT"
            :max="MAX_CAPTION_PCT"
            :step="0.5"
            :default-value="DEFAULT_CAPTIONS.sizePct"
            unit="%"
            @update:model-value="(v) => set({ sizePct: v })"
          />
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Shown over the video while this tab is open. Fix wording on the Transcripts page before rendering.
          </p>
        </template>
      </template>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
// The Text tab's "Subtitles" group: burn the video's transcript (and optionally a
// translation as a second line) into the picture, as part of the overlay render.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { CAPTION_STYLES, DEFAULT_CAPTIONS, MAX_CAPTION_PCT, MIN_CAPTION_PCT, type CaptionSettings } from '#shared/utils/burnedCaptions'
import { pickTranscript } from '#shared/utils/transcriptCuts'
import type { OverlayEdit } from '~/composables/useOverlayEdit'
import type { CaptionSource } from '~/composables/useCaptionSource'

const props = defineProps<{ edit: OverlayEdit; source: CaptionSource; videoLanguage: string | null }>()

const NONE = 'none'
const POSITIONS = [
  { value: 'BOTTOM' as const, label: 'Bottom', icon: 'i-lucide-panel-bottom' },
  { value: 'TOP' as const, label: 'Top', icon: 'i-lucide-panel-top' }
]

const open = ref(false)
watch(
  () => !!props.edit.state.captions,
  (on) => {
    if (!on) return
    open.value = true
    props.source.load()
  },
  { immediate: true }
)

const label = (t: { language: string; segmentCount: number }) => `${languageLabel(t.language)} · ${t.segmentCount} lines`
const transcriptItems = computed(() => props.source.transcripts.value.map((t) => ({ label: label(t), value: t.id })))
const secondItems = computed(() => [
  { label: 'None', value: NONE },
  ...props.source.transcripts.value.filter((t) => t.id !== props.edit.state.captions?.transcriptId).map((t) => ({ label: label(t), value: t.id }))
])

const hint = computed(() => {
  const c = props.edit.state.captions
  if (!c) return ''
  const t = props.source.transcripts.value.find((x) => x.id === c.transcriptId)
  const two = props.source.transcripts.value.find((x) => x.id === c.secondTranscriptId)
  return t ? `${languageLabel(t.language)}${two ? ` + ${languageLabel(two.language)}` : ''}` : 'pick a transcript'
})

function set(patch: Partial<CaptionSettings>) {
  if (props.edit.state.captions) props.edit.state.captions = { ...props.edit.state.captions, ...patch }
}

// Turning it on picks the transcript in the video's own language (once the list is in).
async function onToggle(on: boolean) {
  if (!on) {
    props.edit.state.captions = null
    return
  }
  props.edit.state.captions = { ...DEFAULT_CAPTIONS }
  await props.source.load()
  const picked = pickTranscript(props.source.transcripts.value, props.videoLanguage)
  if (picked && props.edit.state.captions && props.edit.state.captions.transcriptId == null) set({ transcriptId: picked.id })
}

// The lines for the preview.
watch(
  () => [props.edit.state.captions?.transcriptId, props.edit.state.captions?.secondTranscriptId] as const,
  ([a, b]) => {
    props.source.ensureLines(a ?? null)
    props.source.ensureLines(b ?? null)
  },
  { immediate: true }
)
</script>
