<template>
  <AudioVideoStepCard :step="2" title="The look">
    <template #aside>
      <AudioVideoSavedLooks />
    </template>
    <div class="space-y-5">
      <!-- Pictures: one, or a slideshow with the time each one appears -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pictures <span class="font-normal text-gray-500">(optional, shared by all the videos)</span>
          </p>
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
              : 'Fitted inside the frame, not stretched. Add more than one to change the picture over time. The first picture is the thumbnail.'
          }}
        </p>
        <div v-if="slides.length || items.some((i) => i.coverKey)" class="flex flex-wrap gap-x-5 gap-y-2" data-testid="picture-motion">
          <USwitch v-if="slides.length > 1" v-model="spreadPerRecording" size="sm" label="Spread over each recording" />
          <USwitch v-model="motion" size="sm" label="Slow zoom" />
          <USwitch v-if="slides.length > 1" v-model="crossfade" size="sm" label="Dissolve between pictures" />
        </div>
      </div>

      <!-- Title card -->
      <USwitch
        v-model="titleCard"
        :disabled="slides.length > 0"
        label="Write the title on the picture"
        :description="slides.length ? 'Not used when there are pictures.' : 'Each video shows its own title, centred on the background.'"
      />

      <!-- Background -->
      <div class="space-y-2">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Background colour</p>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="c in BACKGROUND_SWATCHES"
            :key="c"
            type="button"
            class="h-7 w-7 rounded-full border border-gray-300 focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-gray-600"
            :class="background === c ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''"
            :style="{ backgroundColor: c }"
            :aria-label="`Background ${c}`"
            :aria-pressed="background === c"
            @click="setBackground(c)"
          />
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
        </div>
      </div>

      <!-- Waveform -->
      <div class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Moving waveform</p>
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
      </div>

      <!-- Shape -->
      <div class="space-y-2">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Shape</p>
        <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Shape">
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
            @click="shape = sh.value"
          >
            {{ sh.label }} <span class="text-xs opacity-70">{{ sh.hint.split(' — ')[0] }}</span>
          </UButton>
        </div>
      </div>

      <!-- A strip of text and a logo over the picture -->
      <div class="space-y-2" data-testid="branding">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Title strip and logo</p>
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

      <!-- Size -->
      <div class="space-y-2">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Video size</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Video size">
          <UButton
            v-for="r in VIDEO_RESOLUTIONS"
            :key="r.value"
            size="sm"
            :color="resolution === r.value ? 'primary' : 'neutral'"
            :variant="resolution === r.value ? 'soft' : 'ghost'"
            :aria-pressed="resolution === r.value"
            @click="resolution = r.value"
          >
            {{ r.label }} <span class="text-xs opacity-70 tabular-nums">{{ frameSizeLabel(r.value, shape) }}</span>
          </UButton>
        </div>
      </div>
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
  commitBackgroundText,
  onPickPictures,
  typeStart,
  movePicture,
  removeSlide,
  spread,
  onPickLogo,
  clearLogo
} = useAudioToVideoFormContext()
</script>
