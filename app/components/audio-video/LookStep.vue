<template>
  <AudioVideoStepCard :step="2" title="The look">
    <template #aside>
      <div class="flex items-center gap-1">
        <!-- On a phone the preview is below every step: a way to it while choosing the look -->
        <UButton class="lg:hidden" size="xs" color="neutral" variant="ghost" icon="i-lucide-eye" @click="showPreview">Preview</UButton>
        <AudioVideoSavedLooks />
      </div>
    </template>
    <div class="space-y-5 divide-y divide-gray-100 dark:divide-gray-800">
      <!-- The frame: its shape and size, which everything else is placed in -->
      <section class="space-y-3 pt-5 first:pt-0" aria-labelledby="look-frame">
        <h3 id="look-frame" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-frame" class="size-4 text-gray-400" />Frame
        </h3>
        <!-- Segmented choices: on a phone each label sits above equal-width segments (HIG Segmented controls) -->
        <div class="grid grid-cols-1 gap-y-2 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-3">
          <span class="text-xs text-gray-500 dark:text-gray-400">Shape</span>
          <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label="Shape">
            <UButton
              v-for="sh in VIDEO_SHAPES"
              :key="sh.value"
              size="sm"
              role="radio"
              :icon="sh.icon"
              :title="sh.hint"
              :color="shape === sh.value ? 'primary' : 'neutral'"
              :variant="shape === sh.value ? 'soft' : 'ghost'"
              :aria-checked="shape === sh.value"
              class="max-sm:justify-center"
              @click="shape = sh.value"
            >
              {{ sh.label }} <span class="text-xs font-normal">{{ sh.hint.split(' — ')[0] }}</span>
            </UButton>
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">Size</span>
          <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" role="radiogroup" aria-label="Video size">
            <UButton
              v-for="r in VIDEO_RESOLUTIONS"
              :key="r.value"
              size="sm"
              :color="resolution === r.value ? 'primary' : 'neutral'"
              :variant="resolution === r.value ? 'soft' : 'ghost'"
              role="radio"
              :aria-checked="resolution === r.value"
              class="max-sm:justify-center"
              @click="resolution = r.value"
            >
              {{ r.label }} <span class="text-xs font-normal tabular-nums">{{ frameSizeLabel(r.value, shape) }}</span>
            </UButton>
          </div>
        </div>
      </section>
      <!-- Pictures: one, or a slideshow with the time each one appears -->
      <section class="space-y-3 pt-5 first:pt-0" aria-labelledby="look-pictures">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="look-pictures" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon name="i-lucide-images" class="size-4 text-gray-400" />Pictures
            <span class="font-normal text-gray-500 dark:text-gray-400">· optional, shared by all the videos</span>
          </h3>
          <UButton
            v-if="slides.length > 1"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-align-horizontal-distribute-center"
            :disabled="!spreadStarts"
            :title="
              spreadStarts
                ? `Spread over ${formatDuration(shortestSeconds ?? 0)}, the shortest recording`
                : 'Add the audio first, and make sure it is long enough'
            "
            @click="spread"
          >
            Spread evenly
          </UButton>
        </div>

        <ol v-if="slides.length" class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          <li v-for="(sl, i) in slides" :key="sl.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <img :src="sl.previewUrl" alt="" class="h-10 w-14 shrink-0 rounded object-cover" />
            <p class="min-w-0 flex-1 basis-28 truncate text-sm text-gray-900 dark:text-white" :title="sl.name">{{ sl.name }}</p>
            <div class="flex items-center gap-1.5">
              <label :for="`slide-start-${sl.id}`" class="text-xs text-gray-500 dark:text-gray-400">{{ i === 0 ? 'From' : 'Starts at' }}</label>
              <UInput
                :id="`slide-start-${sl.id}`"
                :model-value="formatTimecode(sl.startMs)"
                size="sm"
                class="w-28"
                :disabled="i === 0"
                :ui="{ base: 'tabular-nums' }"
                @change="(e: Event) => typeStart(sl.id, e)"
              />
            </div>
            <div class="flex items-center">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up"
                :aria-label="`Move ${sl.name} up`"
                :disabled="i === 0"
                @click="movePicture(i, -1)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                :aria-label="`Move ${sl.name} down`"
                :disabled="i === slides.length - 1"
                @click="movePicture(i, 1)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                :aria-label="`Remove ${sl.name}`"
                :disabled="saving"
                @click="removeSlide(sl.id)"
              />
            </div>
          </li>
        </ol>

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-image-plus"
            :loading="picUploading"
            :disabled="slides.length >= MAX_SLIDES"
            @click="picInput?.click()"
          >
            {{ picUploading ? `Uploading ${Math.round(picProgress * 100)}%` : slides.length ? 'Add more pictures' : 'Add pictures' }}
          </UButton>
          <input
            ref="picInput"
            type="file"
            multiple
            class="hidden"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Choose pictures"
            @change="onPickPictures"
          />
        </div>
        <p v-if="errors.cover" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.cover }}</p>
        <p v-if="slideError" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ slideError }}</p>
        <p v-else-if="beyond" class="text-sm text-warning-700 dark:text-warning-400">
          {{ beyond }} picture{{ beyond === 1 ? '' : 's' }} start after the shortest recording ends and will be skipped for it.
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{
            slides.length > 1
              ? spreadPerRecording
                ? 'Spread evenly over each recording, so every video shows every picture. The first picture is the thumbnail.'
                : 'Each picture stays until the next one starts. The times are the same for every video; the first picture is the thumbnail.'
              : 'Fitted inside the frame, not stretched; you can also drop pictures anywhere on the page. Add more than one to change the picture over time. The first picture is the thumbnail.'
          }}
        </p>
        <div v-if="slides.length || items.some((i) => i.coverKey)" class="flex flex-wrap gap-x-5 gap-y-2" data-testid="picture-motion">
          <USwitch v-if="slides.length > 1" v-model="spreadPerRecording" size="sm" label="Spread over each recording" />
          <USwitch v-model="motion" size="sm" label="Slow zoom" />
          <USwitch v-if="slides.length > 1" v-model="crossfade" size="sm" label="Dissolve between pictures" />
          <USwitch v-model="blurBackdrop" size="sm" label="Blurred backdrop" description="Fills the space around the picture with a soft, darker copy of it." />
        </div>

        <!-- Title card -->
        <USwitch
          v-model="titleCard"
          :disabled="slides.length > 0"
          label="Write the title on the picture"
          :description="slides.length ? 'Not used when there are pictures.' : 'Each video shows its own title, centred on the background.'"
        />
      </section>

      <!-- Background -->
      <section class="space-y-2 pt-5 first:pt-0" aria-labelledby="look-background">
        <h3 id="look-background" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-palette" class="size-4 text-gray-400" />Background colour
        </h3>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="c in BACKGROUND_SWATCHES"
            :key="c"
            type="button"
            class="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-gray-600"
            :class="background === c ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''"
            :style="{ backgroundColor: c }"
            :aria-label="`Background ${c}`"
            :aria-pressed="background === c"
            @click="setBackground(c)"
          >
            <UIcon v-if="background === c" name="i-lucide-check" class="size-4" :class="darkBackground ? 'text-white' : 'text-gray-900'" />
          </button>
          <input
            :value="background"
            type="color"
            aria-label="Pick a background colour"
            class="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            @input="(e) => setBackground((e.target as HTMLInputElement).value)"
          />
          <UInput
            :model-value="backgroundText"
            size="sm"
            class="w-24 font-mono"
            maxlength="7"
            aria-label="Background colour (hex)"
            @update:model-value="(v) => (backgroundText = String(v))"
            @change="commitBackgroundText"
          />
          <UButton
            v-if="paletteSource"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-pipette"
            title="A dark background and a bright waveform colour from the picture"
            @click="useCoverColours"
          >
            Use the picture's colours
          </UButton>
        </div>
      </section>

      <!-- Waveform -->
      <section class="space-y-2 pt-5 first:pt-0" aria-labelledby="look-waveform">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 id="look-waveform" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon name="i-lucide-audio-waveform" class="size-4 text-gray-400" />Moving waveform
          </h3>
          <AnimationSpeed v-if="waveform !== 'NONE'" label="Preview speed" />
        </div>
        <WaveTemplatePicker
          :current="currentWaveLook"
          :audio="audioPeaks.peaks.value"
          :styles="offeredStyles"
          @apply="applyWaveLook"
          @clear="waveform = 'NONE'"
        />

        <!-- The templates are the way in; the style and colour can still be changed by hand -->
        <div v-if="waveform !== 'NONE'" class="space-y-2">
          <UButton
            size="xs"
            color="neutral"
            variant="link"
            :padded="false"
            :icon="customOpen ? 'i-lucide-chevron-up' : 'i-lucide-sliders-horizontal'"
            :aria-expanded="customOpen"
            @click="customOpen = !customOpen"
          >
            {{ customOpen ? 'Hide style and colour' : 'Change style or colour' }}
          </UButton>
          <div v-if="customOpen" class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
            <div class="flex flex-wrap gap-2" role="group" aria-label="Waveform style">
              <UButton
                v-for="w in WAVEFORM_STYLES.filter((x) => x.value !== 'NONE' && offeredStyles.includes(x.value))"
                :key="w.value"
                size="sm"
                :color="waveform === w.value ? 'primary' : 'neutral'"
                :variant="waveform === w.value ? 'soft' : 'ghost'"
                :aria-pressed="waveform === w.value"
                :title="w.hint"
                @click="waveform = w.value"
              >
                <WaveformPreview :kind="w.value" color="currentColor" mini class="h-4 w-9 shrink-0" :still="waveform !== w.value" />
                {{ w.label }}
              </UButton>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <USwitch v-model="waveAuto" label="Colour to suit the background" />
              <input
                v-if="!waveAuto"
                v-model="waveColor"
                type="color"
                aria-label="Waveform colour"
                class="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
              />
            </div>
            <div class="flex flex-wrap items-center gap-3" data-testid="wave-finish">
              <USwitch :model-value="!!waveColor2" label="Shade across to" @update:model-value="(on) => (waveColor2 = on ? '#00c8ff' : null)" />
              <input
                v-if="waveColor2"
                v-model="waveColor2"
                type="color"
                aria-label="Waveform second colour"
                class="h-8 w-10 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
              />
              <USwitch v-model="waveGlow" label="Glow" description="A soft halo around the waveform." />
            </div>
          </div>
        </div>
        <!-- How close the preview is: from the user's own sound, or a sketch; plus a real test render -->
        <div
          v-if="waveform !== 'NONE'"
          class="space-y-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700"
          data-testid="preview-accuracy"
        >
          <p class="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <UIcon :name="previewFromAudio ? 'i-lucide-audio-waveform' : 'i-lucide-info'" class="mt-0.5 size-3.5 shrink-0" />
            {{ previewNote }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-clapperboard"
              :loading="testRendering"
              :disabled="!testAudioKey || testRendering"
              @click="onTestRender"
            >
              Test render ({{ TEST_RENDER_SECONDS }} s)
            </UButton>
            <span v-if="!testAudioKey" class="text-xs text-gray-500 dark:text-gray-400">Add an audio file first.</span>
            <span v-else class="text-xs text-gray-500 dark:text-gray-400"
              >Made by the server from your real sound, small and without pictures — press play to watch it with the sound.</span
            >
          </div>
          <div v-if="testRender" class="space-y-1">
            <video :key="testRender.url" :src="testRender.url" class="aspect-video w-full max-w-md rounded-md bg-black" controls loop playsinline />
            <p v-if="testRenderStale" class="text-xs text-warning-600 dark:text-warning-400">The look has changed since this test — render again to see it.</p>
          </div>
        </div>
        <!-- How tall the waveform is drawn (the preview follows) -->
        <SliderRow
          v-if="waveform !== 'NONE'"
          label="Height"
          :model-value="waveHeightShown"
          :min="MIN_WAVE_HEIGHT_PCT"
          :max="MAX_WAVE_HEIGHT_PCT"
          :step="5"
          :default-value="defaultWaveHeight(waveform)"
          unit="%"
          data-testid="wave-height"
          @update:model-value="setWaveHeight"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{
            waveform === 'NONE'
              ? 'A still picture makes the smallest file.'
              : `${waveformPlacement(waveform) === 'CENTER' ? 'Drawn in the middle' : 'Drawn along the bottom'}, ${waveHeightShown} % of the picture's height. The file is somewhat larger than a still picture.`
          }}
        </p>
      </section>

      <!-- A strip of text and a logo over the picture. Optional, so folded away until used; the heading says what's set. -->
      <details
        :open="brandingOpen"
        class="group/fold pt-5 first:pt-0"
        data-testid="branding"
        @toggle="brandingOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary :class="FOLD_SUMMARY">
          <h3 class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon name="i-lucide-type" class="size-4 text-gray-400" />Title strip and logo
          </h3>
          <span class="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">· {{ inUse.branding.join(', ') || 'optional' }}</span>
          <UIcon name="i-lucide-chevron-down" :class="FOLD_CHEVRON" />
        </summary>
        <div class="space-y-2 pt-3">
          <UInput
            v-model="stripText"
            :maxlength="MAX_STRIP"
            size="sm"
            class="w-full"
            placeholder="e.g. Episode 4 · with Dara — shown the whole time"
            aria-label="Strip text"
          />
          <div class="flex flex-wrap items-center gap-2">
            <img v-if="logoUrl" :src="logoUrl" alt="" class="h-8 max-w-24 rounded object-contain ring-1 ring-gray-200 dark:ring-gray-700" />
            <UploadButton
              v-if="!logoKey"
              label="Add a logo"
              accept="image/png,image/jpeg,image/webp"
              :progress="logoUploading ? logoProgress : null"
              @pick="onPickLogo"
            />
            <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearLogo">Remove logo</UButton>
            <span class="text-xs text-gray-500 dark:text-gray-400"
              >The logo sits in the top-right corner; the strip at the bottom (at the top when a waveform runs along the bottom).</span
            >
          </div>
        </div>
      </details>

      <!-- Progress, chapters and cards: folded the same way -->
      <details
        :open="onPictureOpen"
        class="group/fold pt-5 first:pt-0"
        data-testid="on-picture"
        @toggle="onPictureOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary :class="FOLD_SUMMARY">
          <h3 class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon name="i-lucide-layers" class="size-4 text-gray-400" />Progress, chapters and cards
          </h3>
          <span class="min-w-0 truncate text-sm text-gray-500 dark:text-gray-400">· {{ inUse.onPicture.join(', ') || 'optional' }}</span>
          <UIcon name="i-lucide-chevron-down" :class="FOLD_CHEVRON" />
        </summary>
        <div class="space-y-3 pt-3">
          <USwitch
            v-model="progressBar"
            label="Progress bar"
            description="A thin bar along the bottom fills up as the recording plays, so viewers see how much is left."
          />
          <USwitch
            v-if="chapterCount"
            v-model="useChapters"
            :label="`Use the chapters (${chapterCount})`"
            description="Each chapter's title shows top left for a few seconds as it starts, and learners can jump between them under Chapters."
          />
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div v-for="c in cards" :key="c.name" class="space-y-1">
              <UFormField :label="`${c.name} card`">
                <div class="flex items-center gap-2">
                  <UInput
                    v-model="c.card.text"
                    :maxlength="MAX_CARD_TEXT"
                    size="sm"
                    class="min-w-0 flex-1"
                    :placeholder="c.placeholder"
                    :aria-label="`${c.name} card text`"
                  />
                  <UInput
                    v-model.number="c.card.seconds"
                    type="number"
                    :min="MIN_CARD_SECONDS"
                    :max="MAX_CARD_SECONDS"
                    step="0.5"
                    size="sm"
                    class="w-20"
                    :aria-label="`${c.name} card seconds`"
                  />
                  <span class="text-xs text-gray-500 dark:text-gray-400">s</span>
                </div>
                <!-- Under the boxes, so the intro's and outro's boxes line up whatever the length of their notes -->
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ c.hint }}</p>
              </UFormField>
            </div>
          </div>
          <p v-if="cardsError" class="text-xs text-error-600 dark:text-error-400" role="alert">{{ cardsError }}</p>
        </div>
      </details>
    </div>
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 2 of "Video from audio": pictures, background, waveform, shape, strip and logo, and size.
import {
  frameSizeLabel,
  MAX_STRIP,
  VIDEO_SHAPES,
  MIN_WAVE_HEIGHT_PCT,
  MAX_WAVE_HEIGHT_PCT,
  defaultWaveHeight,
  BACKGROUND_SWATCHES,
  VIDEO_RESOLUTIONS,
  WAVEFORM_STYLES,
  waveformPlacement
} from '#shared/utils/audioVideo'
import { formatTimecode } from '#shared/utils/transport'
import { MAX_SLIDES } from '#shared/utils/slides'
import { extrasInUse, MAX_CARD_SECONDS, MIN_CARD_SECONDS } from '#shared/utils/audioVideoExtras'
import { MAX_CARD_TEXT } from '#shared/utils/trimExtras'
const picInput = useTemplateRef<HTMLInputElement>('picInput')
const {
  items,
  slides,
  picUploading,
  picProgress,
  background,
  backgroundText,
  resolution,
  waveform,
  waveAuto,
  waveColor,
  titleCard,
  shape,
  motion,
  crossfade,
  spreadPerRecording,
  stripText,
  logoKey,
  logoUrl,
  logoUploading,
  logoProgress,
  waveHeightShown,
  setWaveHeight,
  errors,
  saving,
  slideError,
  shortestSeconds,
  beyond,
  spreadStarts,
  currentWaveLook,
  applyWaveLook,
  TEST_RENDER_SECONDS,
  audioPeaks,
  previewFromAudio,
  previewNote,
  testAudioKey,
  testRendering,
  testRender,
  testRenderStale,
  onTestRender,
  customOpen,
  offeredStyles,
  setBackground,
  darkBackground,
  commitBackgroundText,
  onPickPictures,
  typeStart,
  movePicture,
  removeSlide,
  spread,
  onPickLogo,
  clearLogo,
  blurBackdrop,
  progressBar,
  useChapters,
  chapterCount,
  intro,
  outro,
  cardsError,
  paletteSource,
  useCoverColours,
  waveColor2,
  waveGlow
} = useAudioToVideoFormContext()
/** Brings the preview into view (instantly when the user prefers less motion). */
function showPreview() {
  document.getElementById('preview')?.scrollIntoView({ behavior: scrollMotion(), block: 'start' })
}
const cards = [
  { name: 'Intro', card: intro, hint: 'Before the recording, on the background with the logo.', placeholder: 'e.g. Lesson 4 — Greetings' },
  { name: 'Outro', card: outro, hint: 'After it. Leave empty for none.', placeholder: 'e.g. Thanks for listening!' }
]

// The two optional groups fold away until used: each opens by itself once something in it is set (typed, put back
// with a saved look, or chapters found in a file), and can be folded again by hand.
const FOLD_SUMMARY =
  'flex cursor-pointer list-none items-center gap-1.5 rounded select-none focus-visible:outline-2 focus-visible:outline-primary-500 [&::-webkit-details-marker]:hidden'
const FOLD_CHEVRON = 'ml-auto size-4 shrink-0 text-gray-400 transition-transform group-open/fold:rotate-180 motion-reduce:transition-none'
const inUse = computed(() =>
  extrasInUse({
    strip: stripText.value,
    logo: !!logoKey.value,
    progressBar: progressBar.value,
    chapters: chapterCount.value,
    useChapters: useChapters.value,
    intro: intro.text,
    outro: outro.text
  })
)
const brandingOpen = ref(false)
const onPictureOpen = ref(false)
watch(
  () => inUse.value.branding.length > 0,
  (used) => used && (brandingOpen.value = true),
  { immediate: true }
)
watch(
  () => inUse.value.onPicture.length > 0 || chapterCount.value > 0,
  (used) => used && (onPictureOpen.value = true),
  { immediate: true }
)
</script>
