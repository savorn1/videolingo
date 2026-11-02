<template>
  <aside id="preview" class="scroll-mt-4 lg:col-span-2 lg:sticky lg:top-4 space-y-2" aria-label="Preview">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</p>
      <!-- On a phone the preview comes after every step: a way back to the look -->
      <UButton class="mr-auto lg:hidden" size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-up" @click="scrollToStep(2)">Back to the look</UButton>
      <!-- Several recordings: choose which one's title, own picture and length the preview shows -->
      <USelect
        v-if="readyItems.length > 1"
        :model-value="previewItem?.id"
        :items="previewChoices"
        size="xs"
        class="w-48"
        aria-label="Recording shown in the preview"
        @update:model-value="(v) => (previewItemId = Number(v))"
      />
    </div>
    <div
      class="relative mx-auto w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
      :class="shape === 'TALL' ? 'max-w-[56%]' : shape === 'SQUARE' ? 'max-w-[75%]' : ''"
      :style="{ backgroundColor: background, aspectRatio: shape === 'TALL' ? '9 / 16' : shape === 'SQUARE' ? '1 / 1' : '16 / 9' }"
    >
      <img
        v-if="blurBackdrop && (previewOwnCover || shownSlide)"
        :src="previewOwnCover ?? shownSlide!.previewUrl"
        alt=""
        class="absolute inset-0 h-full w-full scale-110 object-cover blur-md brightness-[0.85]"
        data-testid="preview-backdrop"
      />
      <img
        v-if="previewOwnCover || shownSlide"
        :src="previewOwnCover ?? shownSlide!.previewUrl"
        alt="Picture shown at this time"
        class="absolute inset-0 h-full w-full object-contain"
        :class="motion ? 'preview-zoom motion-reduce:animate-none' : ''"
      />
      <p
        v-else-if="titleCard"
        class="absolute inset-x-[10%] top-1/2 -translate-y-1/2 text-center text-lg font-bold leading-tight sm:text-xl"
        :style="{ color: textColor }"
      >
        {{ previewTitle }}
      </p>
      <!-- Nothing drawn on the colour yet: say so, rather than show a waveform the video won't have -->
      <div
        v-else-if="plainFrame"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"
        :class="darkBackground ? 'text-white/70' : 'text-black/60'"
        data-testid="preview-plain"
      >
        <UIcon name="i-lucide-image-off" class="size-8 opacity-60" />
        <p class="max-w-56 text-xs">Just the background colour — add pictures, a waveform or the title.</p>
        <UButton size="xs" color="neutral" variant="solid" icon="i-lucide-type" @click="titleCard = true">Write the title</UButton>
      </div>
      <!-- A moving sketch of the chosen style, so the look and placement can be judged -->
      <!-- The gradient as a second copy in the second colour, faded in from the left; the glow as a soft shadow -->
      <WaveformPreview
        v-for="layer in waveLayers"
        :key="layer.key"
        :kind="waveform"
        :color="layer.color"
        :audio="audioPeaks.peaks.value"
        class="absolute w-full"
        :class="waveformPlacement(waveform) === 'CENTER' ? 'inset-x-[10%] w-4/5' : 'inset-x-0 bottom-[5%]'"
        :style="[
          waveformPlacement(waveform) === 'CENTER'
            ? { height: `${waveHeightShown}%`, top: `${(100 - waveHeightShown) / 2}%` }
            : { height: `${waveHeightShown}%` },
          layer.style
        ]"
        :data-testid="layer.key === 'base' ? 'preview-wave' : undefined"
      />
      <!-- The strip, the logo and a sample subtitle, placed as the server places them -->
      <span
        v-if="stripText.trim()"
        class="absolute left-[4%] max-w-[80%] truncate rounded-sm bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white"
        :class="stripOnTop ? 'top-[5%]' : 'bottom-[8%]'"
        >{{ stripText }}</span
      >
      <img v-if="logoUrl" :src="logoUrl" alt="" class="absolute right-[4%] top-[4%] w-[18%] object-contain" />
      <span
        v-if="chapterNow"
        class="absolute left-[4%] max-w-[70%] truncate rounded-sm bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white"
        :class="stripText.trim() && stripOnTop ? 'top-[14%]' : 'top-[5%]'"
        data-testid="preview-chapter"
        >{{ chapterNow }}</span
      >
      <div v-if="progressBar" class="absolute inset-x-0 bottom-0 h-[1.2%] min-h-[3px]" data-testid="preview-progress">
        <div class="absolute inset-0 opacity-25" :style="{ backgroundColor: waveDrawColor }" />
        <div class="absolute inset-y-0 left-0" :style="{ width: `${progressShare * 100}%`, backgroundColor: waveDrawColor }" />
      </div>
      <span
        v-if="transcribe && burnSubtitles"
        class="absolute inset-x-[8%] text-center text-[11px] font-bold leading-tight"
        :class="[subtitlePosition === 'TOP' ? 'top-[6%]' : 'bottom-[6%]', subtitleStyle === 'YELLOW' ? 'text-yellow-300' : 'text-white']"
        :style="subtitleStyle === 'BOX' ? undefined : { textShadow: '0 0 3px #000, 0 0 3px #000' }"
        ><span v-if="subtitleStyle === 'KARAOKE'"><span class="text-amber-300">The spoken words</span> appear here</span
        ><span v-else :class="subtitleStyle === 'BOX' ? 'rounded-sm bg-black/50 px-1' : ''">The spoken words appear here</span
        ><span v-if="secondLanguage" class="block text-[9px] font-semibold text-yellow-100">…and their translation here</span></span
      >
      <!-- An intro or outro card, as the video shows it before or after the recording -->
      <div
        v-if="shownCard"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-[10%] text-center"
        :style="{ backgroundColor: background }"
        data-testid="preview-card"
      >
        <img v-if="logoUrl" :src="logoUrl" alt="" class="w-[18%] object-contain" />
        <p class="text-base font-bold leading-tight sm:text-lg" :style="{ color: textColor }">{{ shownCard }}</p>
      </div>
    </div>
    <div v-if="intro.text.trim() || outro.text.trim() || music" class="flex flex-wrap items-center gap-1.5">
      <template v-for="c in previewCards" :key="c.which">
        <UButton
          v-if="c.text"
          size="xs"
          :color="showCard === c.which ? 'primary' : 'neutral'"
          :variant="showCard === c.which ? 'soft' : 'ghost'"
          :aria-pressed="showCard === c.which"
          @click="showCard = showCard === c.which ? null : c.which"
          >{{ c.label }}</UButton
        >
      </template>
      <UButton
        v-if="music && previewItem"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="hearingMix ? 'i-lucide-square' : 'i-lucide-music'"
        :title="hearingMix ? undefined : 'From the preview time, for 15 s. The video also dips the music under speech.'"
        @click="hearWithMusic"
        >{{ hearingMix ? 'Stop' : 'Hear it with the music' }}</UButton
      >
    </div>
    <div v-if="(slides.length > 1 || progressBar || previewChapters.length) && previewMax > 0" class="space-y-1">
      <USlider v-model="previewSeconds" :min="0" :max="previewMax" :step="1" aria-label="Preview time" />
      <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
        Showing what appears at {{ formatDuration(previewSeconds)
        }}<template v-if="slides.length > 1"> (picture {{ shownIndex + 1 }} of {{ slides.length }})</template>
      </p>
    </div>
    <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      <dt>Size</dt>
      <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ selectedSize }}</dd>
      <dt>Length</dt>
      <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ totalLength }}</dd>
      <dt>Videos</dt>
      <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ readyItems.length ? videoCountLabel : '—' }}</dd>
      <dt title="Not counting uploads or waiting behind other jobs">Render time</dt>
      <dd class="text-right text-gray-700 dark:text-gray-300">{{ renderNote }}</dd>
    </dl>
    <AudioVideoStepNav class="pt-3" />
  </aside>
</template>

<script setup lang="ts">
// How the frame will look: the picture (on its blurred backdrop), waveform, strip, logo, chapter title, progress bar and a
// sample subtitle, placed as the server places them.
import { waveformPlacement } from '#shared/utils/audioVideo'
const {
  slides,
  previewSeconds,
  background,
  waveform,
  titleCard,
  transcribe,
  shape,
  motion,
  stripText,
  logoUrl,
  waveHeightShown,
  burnSubtitles,
  subtitleStyle,
  subtitlePosition,
  stripOnTop,
  videoCountLabel,
  previewOwnCover,
  readyItems,
  previewMax,
  shownIndex,
  shownSlide,
  selectedSize,
  totalLength,
  renderNote,
  darkBackground,
  textColor,
  audioPeaks,
  waveDrawColor,
  previewTitle,
  previewItem,
  previewItemId,
  blurBackdrop,
  progressBar,
  useChapters,
  secondLanguage,
  waveColor2,
  waveGlow,
  intro,
  outro,
  music,
  hearWithMusic,
  hearingMix,
  scrollToStep
} = useAudioToVideoFormContext()
// The video would be the background colour alone: no picture, title, waveform, strip or logo.
const plainFrame = computed(
  () => !previewOwnCover.value && !shownSlide.value && !titleCard.value && waveform.value === 'NONE' && !stripText.value.trim() && !logoUrl.value
)

// Showing a card in the frame, by choice (it goes when its text is cleared).
const showCard = ref<'intro' | 'outro' | null>(null)
const previewCards = computed(() => [
  { which: 'intro' as const, label: 'Intro card', text: intro.text.trim() },
  { which: 'outro' as const, label: 'Outro card', text: outro.text.trim() }
])
const shownCard = computed(() => previewCards.value.find((c) => c.which === showCard.value)?.text || null)

const waveLayers = computed(() => {
  if (waveform.value === 'NONE') return []
  const glow: Record<string, string> = waveGlow.value
    ? { filter: `drop-shadow(0 0 3px ${waveDrawColor.value}) drop-shadow(0 0 6px ${waveDrawColor.value})` }
    : {}
  const layers: { key: string; color: string; style: Record<string, string> }[] = [{ key: 'base', color: waveDrawColor.value, style: glow }]
  if (waveColor2.value) {
    const fade = 'linear-gradient(to right, transparent, black)'
    layers.push({ key: 'shade', color: waveColor2.value, style: { maskImage: fade, WebkitMaskImage: fade } })
  }
  return layers
})

// The chapter title showing at the previewed time (as the video shows it: for 4 s from the chapter's start).
const previewChapters = computed(() => (useChapters.value ? (previewItem.value?.chapters ?? []) : []))
const chapterNow = computed(() => {
  const ms = previewSeconds.value * 1000
  return previewChapters.value.find((c) => ms >= c.startMs && ms < c.startMs + 4000)?.title ?? null
})
// How far the bar has filled at the previewed time (a third of the way when there's no length to go by).
const progressShare = computed(() => (previewMax.value > 0 ? Math.min(1, previewSeconds.value / previewMax.value) : 1 / 3))

const previewChoices = computed(() => readyItems.value.map((i, n) => ({ label: `${n + 1}. ${i.title.trim() || i.name}`, value: i.id })))
</script>

<style scoped>
/* The preview's stand-in for "Slow zoom": the picture grows a little and back (the video grows once per picture). */
.preview-zoom {
  animation: preview-zoom 6s ease-in-out infinite alternate;
}
@keyframes preview-zoom {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.06);
  }
}
</style>
