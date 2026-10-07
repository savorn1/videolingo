<template>
  <aside class="lg:col-span-2 lg:sticky lg:top-4 space-y-2" aria-label="Preview">
    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</p>
    <div
      class="relative mx-auto w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
      :class="shape === 'TALL' ? 'max-w-[56%]' : shape === 'SQUARE' ? 'max-w-[75%]' : ''"
      :style="{ backgroundColor: background, aspectRatio: shape === 'TALL' ? '9 / 16' : shape === 'SQUARE' ? '1 / 1' : '16 / 9' }"
    >
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
      <div v-else class="absolute inset-0 flex items-center justify-center">
        <UIcon name="i-lucide-audio-lines" class="h-12 w-12" :class="darkBackground ? 'text-white/40' : 'text-black/30'" />
      </div>
      <!-- A moving sketch of the chosen style, so the look and placement can be judged -->
      <WaveformPreview
        v-if="waveform !== 'NONE'"
        :kind="waveform"
        :color="waveDrawColor"
        :audio="audioPeaks.peaks.value"
        class="absolute w-full"
        :class="waveformPlacement(waveform) === 'CENTER' ? 'inset-x-[10%] w-4/5' : 'inset-x-0 bottom-[5%]'"
        :style="
          waveformPlacement(waveform) === 'CENTER'
            ? { height: `${waveHeightShown}%`, top: `${(100 - waveHeightShown) / 2}%` }
            : { height: `${waveHeightShown}%` }
        "
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
        v-if="transcribe && burnSubtitles"
        class="absolute inset-x-[8%] text-center text-[11px] font-bold leading-tight"
        :class="[subtitlePosition === 'TOP' ? 'top-[6%]' : 'bottom-[6%]', subtitleStyle === 'YELLOW' ? 'text-yellow-300' : 'text-white']"
        :style="subtitleStyle === 'BOX' ? undefined : { textShadow: '0 0 3px #000, 0 0 3px #000' }"
        ><span :class="subtitleStyle === 'BOX' ? 'rounded-sm bg-black/50 px-1' : ''">The spoken words appear here</span></span
      >
    </div>
    <div v-if="slides.length > 1 && previewMax > 0" class="space-y-1">
      <USlider v-model="previewSeconds" :min="0" :max="previewMax" :step="1" aria-label="Preview time" />
      <p class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
        Showing what appears at {{ formatDuration(previewSeconds) }} (picture {{ shownIndex + 1 }} of {{ slides.length }})
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
  </aside>
</template>

<script setup lang="ts">
// How the frame will look: the picture, waveform, strip, logo and a sample subtitle, placed as the server places them.
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
  previewTitle
} = useAudioToVideoFormContext()
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
