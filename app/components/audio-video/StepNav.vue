<template>
  <nav class="hidden space-y-1 lg:block" aria-label="Steps" data-testid="step-nav">
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Steps</p>
    <ol class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      <li v-for="st in steps" :key="st.step">
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-primary-500 dark:hover:bg-gray-800/50"
          @click="scrollToStep(st.step)"
        >
          <span class="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" :class="st.badge" aria-hidden="true">{{
            st.step
          }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ st.title }}</span>
            <span class="block truncate text-xs text-gray-500 dark:text-gray-400" :title="st.summary">{{ st.summary }}</span>
          </span>
          <UIcon v-if="st.problem" name="i-lucide-circle-alert" class="size-4 shrink-0 text-warning-500" aria-label="Needs attention" />
          <UIcon v-else-if="st.done" name="i-lucide-circle-check" class="size-4 shrink-0 text-success-600 dark:text-success-500" aria-label="Done" />
        </button>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
// "Video from audio" at a glance, beside the preview: each step's choices in a line, and a click takes you there.
import { VIDEO_SHAPES, WAVEFORM_STYLES } from '#shared/utils/audioVideo'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'

const {
  items,
  readyItems,
  totalLength,
  slides,
  shape,
  resolution,
  waveform,
  stripText,
  logoKey,
  normalize,
  denoise,
  trimSilence,
  chapters,
  partMinutes,
  language,
  languageItems,
  categoryIds,
  collectionId,
  collectionItems,
  transcribe,
  burnSubtitles,
  blockerStep,
  uploadingAny,
  scrollToStep,
  music,
  progressBar,
  blurBackdrop,
  intro,
  outro,
  highlight,
  schedule,
  cardsError
} = useAudioToVideoFormContext()

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const steps = computed(() => {
  const look = [
    VIDEO_SHAPES.find((s) => s.value === shape.value)?.label,
    resolution.value,
    waveform.value === 'NONE' ? 'no waveform' : WAVEFORM_STYLES.find((w) => w.value === waveform.value)?.label.toLowerCase(),
    slides.value.length ? plural(slides.value.length, 'picture') : '',
    stripText.value.trim() ? 'strip' : '',
    logoKey.value ? 'logo' : '',
    blurBackdrop.value && slides.value.length ? 'blurred backdrop' : '',
    progressBar.value ? 'progress bar' : '',
    intro.text.trim() || outro.text.trim() ? 'cards' : ''
  ]
  const sound = [
    normalize.value && 'even loudness',
    denoise.value && 'less noise',
    trimSilence.value && 'trim silence',
    music.value && 'music',
    chapters.value && `parts of ${partMinutes.value} min`
  ].filter(Boolean)
  const details = [
    language.value ? languageItems.value.find((l) => l.value === language.value)?.label : 'no language',
    categoryIds.value.length ? `${categoryIds.value.length} categor${categoryIds.value.length === 1 ? 'y' : 'ies'}` : '',
    collectionId.value ? collectionItems.value.find((c) => c.value === collectionId.value)?.label : '',
    transcribe.value ? (burnSubtitles.value ? 'burned subtitles' : 'transcript') : '',
    highlight.value ? 'highlight clip' : '',
    schedule.value ? 'scheduled' : ''
  ]
  const problemAt = uploadingAny.value ? null : blockerStep.value
  return [
    {
      step: 1,
      title: 'The audio',
      summary: items.value.length ? `${plural(items.value.length, 'file')} · ${totalLength.value}` : 'No files yet',
      done: readyItems.value.length > 0,
      problem: problemAt === 1 && items.value.length > 0,
      badge: TAB_ACCENTS.audio.button
    },
    {
      step: 2,
      title: 'The look',
      summary: look.filter(Boolean).join(' · '),
      done: false,
      problem: problemAt === 2 || (!uploadingAny.value && !!cardsError.value),
      badge: TAB_ACCENTS.split.button
    },
    {
      step: 3,
      title: 'Sound',
      summary: sound.length ? sound.join(' · ') : 'As recorded',
      done: false,
      problem: false,
      badge: TAB_ACCENTS.trim.button
    },
    { step: 4, title: 'Details', summary: details.filter(Boolean).join(' · '), done: false, problem: problemAt === 4, badge: TAB_ACCENTS.join.button }
  ]
})
</script>
