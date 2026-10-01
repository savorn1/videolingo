<template>
  <div @dragenter.prevent="dragging = true" @dragover.prevent @dragleave.self="dragging = false" @drop.prevent="onDrop">
    <PageHeader
      title="Video from audio"
      description="Turn podcasts, songs or lesson recordings into videos: the sound over a picture, a title card or a plain colour, with an optional moving waveform."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Video from audio' }]"
    />

    <!-- Whole-page drop target -->
    <div
      v-if="dragging"
      class="fixed inset-0 z-50 flex items-center justify-center border-4 border-dashed border-primary-400 bg-primary-500/10 pointer-events-none"
      :class="TAB_ACCENTS.audio.scope"
      aria-hidden="true"
    >
      <p class="rounded-lg bg-white px-4 py-2 font-medium text-primary-700 shadow dark:bg-gray-900 dark:text-primary-300">Drop audio files to add them</p>
    </div>

    <form class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start" @submit.prevent="onSubmit">
      <div class="lg:col-span-3 space-y-4">
        <!-- 1. The sound -->
        <UCard :class="STEP_TONES[1].scope" :ui="{ header: STEP_TONES[1].header }">
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h2 class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <span
                  class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  :class="STEP_TONES[1].badge"
                  aria-hidden="true"
                  >1</span
                >
                The audio
                <UIcon v-if="readyItems.length" name="i-lucide-circle-check" class="h-4 w-4 text-success-500" aria-label="Done" />
              </h2>
              <span v-if="items.length > 1" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {{ items.length }} files, {{ items.length }} videos
              </span>
            </div>
          </template>

          <ul v-if="items.length" class="mb-3 divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
            <li v-for="it in items" :key="it.id" class="space-y-2 px-3 py-2.5">
              <div class="flex items-center gap-3">
                <UIcon name="i-lucide-file-audio" class="h-5 w-5 shrink-0 text-primary-500" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="it.name">{{ it.name }}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {{ formatFileSize(it.size) }}<template v-if="it.durationSeconds"> · {{ formatDuration(it.durationSeconds) }}</template>
                    <template v-if="it.status === 'queued'"> · waiting</template>
                    <template v-else-if="it.status === 'uploading'"> · uploading {{ Math.round(it.progress * 100) }}%</template>
                  </p>
                </div>
                <UBadge v-if="it.status === 'ready'" color="success" variant="subtle" size="sm" icon="i-lucide-check">Uploaded</UBadge>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  :aria-label="`Remove ${it.name}`"
                  :disabled="saving"
                  @click="removeItem(it.id)"
                />
              </div>
              <UProgress v-if="it.status === 'uploading'" :model-value="Math.round(it.progress * 100)" size="xs" />
              <p v-if="it.status === 'error'" class="text-sm text-error-600 dark:text-error-400" role="alert">
                {{ it.error }}
                <UButton size="xs" color="neutral" variant="link" :padded="false" @click="retryItem(it.id)">Try again</UButton>
              </p>
              <UInput
                v-if="it.status !== 'error'"
                v-model="it.title"
                size="sm"
                maxlength="200"
                class="w-full"
                :aria-label="`Title for ${it.name}`"
                placeholder="Title"
              />
              <audio v-if="items.length === 1 && it.status === 'ready'" :src="it.previewUrl" controls preload="metadata" class="h-10 w-full" />
            </li>
          </ul>

          <label
            class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus-within:border-primary-500 dark:border-gray-700 dark:hover:bg-primary-950/20"
          >
            <UIcon name="i-lucide-upload" class="h-6 w-6 text-gray-400" />
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ items.length ? 'Add more audio files' : 'Choose audio files' }}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              or drop them anywhere on this page · MP3, M4A, AAC, WAV, OGG, Opus or FLAC · up to {{ maxUploadMb }} MB each · up to {{ MAX_BATCH }} files
            </span>
            <input
              type="file"
              multiple
              class="sr-only"
              accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.weba"
              aria-label="Choose audio files"
              @change="onPickFiles"
            />
          </label>
          <p v-if="errors.audio" class="mt-2 text-sm text-error-600 dark:text-error-400" role="alert">{{ errors.audio }}</p>
        </UCard>

        <!-- 2. The look -->
        <UCard :class="STEP_TONES[2].scope" :ui="{ header: STEP_TONES[2].header }">
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="STEP_TONES[2].badge" aria-hidden="true"
                >2</span
              >
              The look
            </h2>
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
                    ? 'Each picture stays until the next one starts. The times are the same for every video; the first picture is the thumbnail.'
                    : 'Fitted inside the frame, not stretched. Add more than one to change the picture over time. The first picture is the thumbnail.'
                }}
              </p>
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
              <WaveTemplatePicker :current="currentWaveLook" :audio="audioPeaks.peaks.value" @apply="applyWaveLook" @clear="waveform = 'NONE'" />

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
                      v-for="w in WAVEFORM_STYLES.filter((x) => x.value !== 'NONE')"
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
                  <p v-if="testRenderStale" class="text-xs text-warning-600 dark:text-warning-400">
                    The look has changed since this test — render again to see it.
                  </p>
                </div>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{
                  waveform === 'NONE' ? 'A still picture makes the smallest file.' : 'Drawn along the bottom. The file is somewhat larger than a still picture.'
                }}
              </p>
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
                  {{ r.label }} <span class="text-xs opacity-70 tabular-nums">{{ r.size }}</span>
                </UButton>
              </div>
            </div>
          </div>
        </UCard>

        <!-- 3. The sound -->
        <UCard :class="STEP_TONES[3].scope" :ui="{ header: STEP_TONES[3].header }">
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="STEP_TONES[3].badge" aria-hidden="true"
                >3</span
              >
              Sound clean-up
            </h2>
          </template>
          <div class="space-y-3">
            <USwitch v-model="normalize" label="Even out the loudness" description="Brings quiet and loud recordings to the same level." />
            <USwitch v-model="denoise" label="Reduce background noise" description="Softens steady hiss and hum. Voices can sound slightly processed." />
          </div>
        </UCard>

        <!-- 4. The details -->
        <UCard :class="STEP_TONES[4].scope" :ui="{ header: STEP_TONES[4].header }">
          <template #header>
            <h2 class="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold" :class="STEP_TONES[4].badge" aria-hidden="true"
                >4</span
              >
              Details
            </h2>
          </template>
          <div class="space-y-5">
            <UFormField label="Description" description="Shared by all the videos.">
              <UTextarea v-model="description" :rows="3" autoresize :maxrows="10" maxlength="10000" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <UFormField label="Spoken language" :error="errors.language">
                <USelectMenu
                  v-model="language"
                  :items="languageItems"
                  value-key="value"
                  placeholder="Not set"
                  :search-input="{ placeholder: 'Search languages…' }"
                  aria-label="Spoken language"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Categories" :required="requireCategory" :error="errors.categoryIds" :hint="`Up to ${maxCategories}`">
                <USelectMenu
                  v-model="categoryIds"
                  :items="categoryItems"
                  value-key="value"
                  multiple
                  placeholder="Choose categories"
                  aria-label="Categories"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Add to a collection" description="Keeps a series together, in the order you add it.">
                <USelectMenu
                  v-model="collectionId"
                  :items="collectionItems"
                  value-key="value"
                  placeholder="None"
                  :loading="collectionsLoading"
                  aria-label="Collection"
                  class="w-full"
                />
              </UFormField>
            </div>
            <USwitch
              v-model="transcribe"
              :disabled="!language"
              label="Transcribe when ready"
              :description="language ? 'Makes a transcript of each video once it is finished.' : 'Choose the spoken language first.'"
            />
          </div>
        </UCard>

        <UAlert v-if="saveError" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="saveError" />

        <!-- Stays in view while scrolling the long form, and says what is still missing -->
        <div
          class="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
          data-testid="action-bar"
        >
          <div class="mr-auto min-w-0" aria-live="polite">
            <p v-if="blocker" class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <UIcon
                :name="uploadingAny ? 'i-lucide-loader' : 'i-lucide-circle-alert'"
                class="h-4 w-4 shrink-0"
                :class="uploadingAny ? 'animate-spin motion-reduce:animate-none' : 'text-warning-500'"
              />
              {{ blocker }}
            </p>
            <p v-else class="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
              <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0 text-success-500" />
              {{ readySummary }}
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Videos are created hidden. Review each one, then enable it for learners.</p>
          </div>
          <UButton color="neutral" variant="ghost" to="/videos" :disabled="saving">Cancel</UButton>
          <UButton type="submit" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-clapperboard" :loading="saving" :disabled="!canSubmit">{{
            submitLabel
          }}</UButton>
        </div>
      </div>

      <!-- Preview: how the frame will look -->
      <aside class="lg:col-span-2 lg:sticky lg:top-4 space-y-2" aria-label="Preview">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</p>
        <div
          class="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
          :style="{ backgroundColor: background }"
        >
          <img v-if="shownSlide" :src="shownSlide.previewUrl" alt="Picture shown at this time" class="absolute inset-0 h-full w-full object-contain" />
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
            :class="waveformPlacement(waveform) === 'CENTER' ? 'inset-x-[10%] top-[30%] h-[40%] w-4/5' : 'inset-x-0 bottom-[5%] h-1/4'"
          />
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
          <dd class="text-right tabular-nums text-gray-700 dark:text-gray-300">{{ readyItems.length }}</dd>
          <dt title="Not counting uploads or waiting behind other jobs">Render time</dt>
          <dd class="text-right text-gray-700 dark:text-gray-300">{{ renderNote }}</dd>
        </dl>
      </aside>
    </form>
  </div>
</template>

<script setup lang="ts">
import { canDrawFromAudio } from '#shared/utils/waveSamples'
import { MAX_PREVIEW_BYTES } from '~/composables/useAudioPeaks'
import type { WaveLook } from '#shared/utils/waveTemplates'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'

// Makes videos from sounds. Each audio file (and the optional cover) is uploaded
// straight to storage first; then the server makes each video in a background
// job, and this page hands over to the video (one file) or the list (several).
import {
  audioFileProblem,
  BACKGROUND_SWATCHES,
  batchProblem,
  coverFileProblem,
  DEFAULT_BACKGROUND,
  DEFAULT_RESOLUTION,
  MAX_BATCH,
  nextToUpload,
  normalizeHexColor,
  sanitizeLook,
  submitBlocker,
  uniqueTitles,
  VIDEO_RESOLUTIONS,
  WAVEFORM_STYLES,
  waveformPlacement,
  type VideoResolution,
  type WaveformStyle
} from '#shared/utils/audioVideo'
import { uploadToStorage } from '~/composables/useVideos'
import { formatTimecode, parseTimecode } from '#shared/utils/transport'
import { MAX_SLIDES, nextSlideStart, slideIndexAt, slideProblem, slidesBeyond, spreadEvenly, swapContents } from '#shared/utils/slides'

definePageMeta({ middleware: 'admin' })

interface Item {
  id: number
  file: File | null
  name: string
  size: number
  status: 'queued' | 'uploading' | 'ready' | 'error'
  progress: number
  key: string
  error: string
  previewUrl: string
  durationSeconds: number | null
  title: string
}
interface Slide {
  id: number
  key: string
  name: string
  previewUrl: string
  /** When this picture appears, in ms; the first is always 0. */
  startMs: number
}

const videos = useVideos()
const collections = useCollections()
const toast = useToast()
const { settings: clientSettings } = useClientSettings()
const maxUploadMb = computed(() => clientSettings.value?.maxVideoUploadMb ?? 2048)
const maxCategories = computed(() => clientSettings.value?.maxCategoriesPerVideo ?? 10)
const requireCategory = computed(() => clientSettings.value?.requireCategory ?? false)

const items = ref<Item[]>([])
const slides = ref<Slide[]>([])
const picUploading = ref(false)
const picProgress = ref(0)
const picInput = useTemplateRef<HTMLInputElement>('picInput')
const previewSeconds = ref(0)
const background = ref<string>(DEFAULT_BACKGROUND)
const backgroundText = ref<string>(DEFAULT_BACKGROUND)
const resolution = ref<VideoResolution>(DEFAULT_RESOLUTION)
const waveform = ref<WaveformStyle>('NONE')
const waveAuto = ref(true)
const waveColor = ref('#ffffff')
const titleCard = ref(false)
const normalize = ref(false)
const denoise = ref(false)
const description = ref('')
const language = ref<string | undefined>(undefined)
const categoryIds = ref<number[]>([])
const collectionId = ref<number | undefined>(undefined)
const transcribe = ref(false)

const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)
const submitted = ref(false)
const dragging = ref(false)

const languageItems = computed(() => [{ label: 'Not set', value: undefined }, ...languageOptions(language.value)])
const categoryItems = computed(() => categoryOptions(categoryIds.value).map((o) => ({ label: o.label, value: o.value, disabled: o.disabled })))
const collectionItems = ref<{ label: string; value: number | undefined }[]>([{ label: 'None', value: undefined }])
const collectionsLoading = ref(false)
onMounted(async () => {
  collectionsLoading.value = true
  try {
    const res = await collections.list({ size: 100 })
    collectionItems.value = [{ label: 'None', value: undefined }, ...res.data.map((c) => ({ label: c.title, value: c.id }))]
  } catch {
    // The picker just stays on "None".
  } finally {
    collectionsLoading.value = false
  }
})

// A transcript needs to know the language; drop the choice if it goes away.
watch(language, (l) => {
  if (!l) transcribe.value = false
})
// The title goes on the picture only when there are no pictures to show.
watch(
  () => slides.value.length,
  (n) => {
    if (n) titleCard.value = false
  }
)

const readyItems = computed(() => items.value.filter((i) => i.status === 'ready'))

// ── The pictures: times, checks and the preview ──────────────────────────────
const slideStarts = computed(() => slides.value.map((sl) => sl.startMs))
const slideError = computed(() => slideProblem(slideStarts.value))
/** The shortest recording, which the pictures' times are judged against. */
const shortestSeconds = computed(() => {
  const known = readyItems.value.map((i) => i.durationSeconds).filter((d): d is number => !!d)
  return known.length ? Math.min(...known) : null
})
const beyond = computed(() => slidesBeyond(slideStarts.value, shortestSeconds.value))
const spreadStarts = computed(() => (shortestSeconds.value ? spreadEvenly(slides.value.length, shortestSeconds.value) : null))
const previewMax = computed(() => readyItems.value[0]?.durationSeconds ?? 0)
const shownIndex = computed(() => slideIndexAt(slideStarts.value, previewSeconds.value * 1000))
const shownSlide = computed(() => slides.value[shownIndex.value] ?? null)
const uploadingAny = computed(() => picUploading.value || items.value.some((i) => i.status === 'queued' || i.status === 'uploading'))
const blocker = computed(() =>
  submitBlocker({
    files: items.value.filter((i) => i.status !== 'error').length,
    uploading: items.value.filter((i) => i.status === 'queued' || i.status === 'uploading').length + (picUploading.value ? 1 : 0),
    untitled: readyItems.value.filter((i) => !i.title.trim()).length,
    slideError: slideError.value
  })
)
const canSubmit = computed(() => !blocker.value && !saving.value && readyItems.value.length > 0)
const submitLabel = computed(() => {
  if (uploadingAny.value) return 'Waiting for the uploads…'
  const n = readyItems.value.length
  return n > 1 ? `Make ${n} videos` : 'Make the video'
})

const selectedSize = computed(() => VIDEO_RESOLUTIONS.find((r) => r.value === resolution.value)?.size ?? '')
const readySummary = computed(() => {
  const n = readyItems.value.length
  const parts = [`${n} video${n === 1 ? '' : 's'}`, totalLength.value, selectedSize.value]
  if (waveform.value !== 'NONE') parts.push(WAVEFORM_STYLES.find((w) => w.value === waveform.value)?.label.toLowerCase() ?? 'waveform')
  if (slides.value.length > 1) parts.push(`${slides.value.length} pictures`)
  return `Ready: ${parts.filter((p) => p && p !== '—').join(' · ')}`
})

// ── Remember the look between visits ─────────────────────────────────────────
// Background, size, waveform and sound options are usually the same for a whole series, so they are
// kept with the user's other synced preferences and put back next time.
const { load: loadPrefs, appValue, setApp } = useLearnerPrefs()
const LOOK_KEY = 'audioVideoLook'
let lookRestored = false
onMounted(async () => {
  await loadPrefs()
  const saved = appValue<unknown>(LOOK_KEY, null)
  if (saved) {
    const look = sanitizeLook(saved)
    setBackground(look.background)
    resolution.value = look.resolution
    waveform.value = look.waveform
    waveAuto.value = look.waveAuto
    waveColor.value = look.waveColor
    normalize.value = look.normalize
    denoise.value = look.denoise
  }
  lookRestored = true
})
watch([background, resolution, waveform, waveAuto, waveColor, normalize, denoise], () => {
  if (!lookRestored) return // still the defaults; don't overwrite what was saved
  setApp(LOOK_KEY, {
    background: background.value,
    resolution: resolution.value,
    waveform: waveform.value,
    waveAuto: waveAuto.value,
    waveColor: waveColor.value,
    normalize: normalize.value,
    denoise: denoise.value
  })
})
const totalLength = computed(() => {
  const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
  return total ? formatDuration(total) : '—'
})
// Measured on a laptop: 10 minutes of audio rendered in about 15 s (still) to 27 s (waveform at 1080p).
// These rates allow about twice that for a slower server. Only the render is counted: the uploads and
// any wait behind other jobs (the worker does one job at a time) come on top.
const renderNote = computed(() => {
  const total = readyItems.value.reduce((sum, i) => sum + (i.durationSeconds ?? 0), 0)
  if (!total) return '—'
  const perSecond = waveform.value === 'NONE' ? 0.05 : 0.08
  const seconds = Math.round(total * perSecond)
  return seconds < 60 ? 'under a minute' : `about ${Math.round(seconds / 60)} min`
})

// Colours for the preview
const darkBackground = computed(() => {
  const n = parseInt(background.value.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.55
})
const textColor = computed(() => (darkBackground.value ? '#ffffff' : '#111111'))
// The look as it is set now (what a template saves and what marks a template as chosen).
const currentWaveLook = computed<WaveLook | null>(() =>
  waveform.value === 'NONE' ? null : { waveform: waveform.value, waveColor: waveAuto.value ? textColor.value : waveColor.value, background: background.value }
)
function applyWaveLook(look: WaveLook) {
  waveform.value = look.waveform
  waveAuto.value = false
  waveColor.value = look.waveColor
  setBackground(look.background)
}
// ── How close the preview is ─────────────────────────────────────────────────
// The moving sketch is drawn from the first seconds of the user's own sound (decoded in the browser) where the
// style allows; a test render asks the server for a few real seconds. Both are guides — the final video is drawn
// from the whole sound.
const TEST_RENDER_SECONDS = 5
const audioPeaks = useAudioPeaks()
// Items let go of their File once uploaded, so the first one is kept here (only while it is small enough to read) for the preview.
const previewFile = ref<File | null>(null)
const firstFile = computed(() => previewFile.value)
watch(previewFile, (f) => audioPeaks.load(f))
watch(
  () => items.value.length,
  (n) => {
    if (n === 0) previewFile.value = null
  }
)
const previewFromAudio = computed(() => !!audioPeaks.peaks.value && canDrawFromAudio(waveform.value))
const previewNote = computed(() => {
  if (!firstFile.value && items.value.length) return 'The preview is a generic sketch here. Use the test render to see your own sound.'
  if (!firstFile.value) return 'Add an audio file and the preview will move with your own sound.'
  if (audioPeaks.state.value === 'reading') return 'Reading your audio…'
  if (audioPeaks.state.value === 'unavailable')
    return 'This file is too large (or not readable here) to draw live — the preview is a generic sketch. Use the test render.'
  if (!canDrawFromAudio(waveform.value))
    return `${waveform.value === 'BARS' ? 'Bars' : 'Spectrum'} need a frequency analysis, so the preview is a generic sketch. Use the test render to see it.`
  return 'Drawn live from the first seconds of your own audio, at the same speed the video will use.'
})
const testAudioKey = computed(() => readyItems.value[0]?.key ?? '')
const testRendering = ref(false)
const testRender = ref<{ url: string; signature: string } | null>(null)
const testSignature = () =>
  JSON.stringify([testAudioKey.value, background.value, waveform.value, waveAuto.value ? null : waveColor.value, normalize.value, denoise.value])
const testRenderStale = computed(() => !!testRender.value && testRender.value.signature !== testSignature())
async function onTestRender() {
  if (!testAudioKey.value || testRendering.value) return
  testRendering.value = true
  const signature = testSignature()
  try {
    const result = await videos.previewFromAudio({
      audioKey: testAudioKey.value,
      background: background.value,
      waveform: waveform.value,
      waveColor: waveAuto.value ? undefined : waveColor.value,
      normalize: normalize.value || undefined,
      denoise: denoise.value || undefined
    })
    testRender.value = { url: result.url, signature }
  } catch (err) {
    toast.add({ title: 'Could not make the test render', description: apiErrorMessage(err), color: 'error' })
  } finally {
    testRendering.value = false
  }
}

const customOpen = ref(false)
const waveDrawColor = computed(() => (waveAuto.value ? textColor.value : waveColor.value))
const previewTitle = computed(() => readyItems.value[0]?.title.trim() || items.value[0]?.title.trim() || 'Your title here')

function setBackground(value: string) {
  const hex = normalizeHexColor(value)
  if (!hex) return
  background.value = hex
  backgroundText.value = hex
}
function commitBackgroundText() {
  const hex = normalizeHexColor(backgroundText.value)
  if (hex) setBackground(hex)
  else backgroundText.value = background.value // put the last good colour back
}

/** The sound's length, read in the browser so it can be shown before anything is made. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = new Audio()
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : null)
    el.onerror = () => done(null)
    el.src = url
  })
}

// ── The audio files ──────────────────────────────────────────────────────────
let nextId = 1
function addFiles(files: File[]) {
  errors.value.audio = ''
  const problem = batchProblem(items.value.length + files.length)
  if (problem) {
    errors.value.audio = problem
    return
  }
  const rejected: string[] = []
  for (const file of files) {
    const fileProblem = audioFileProblem(file, maxUploadMb.value)
    if (fileProblem) {
      rejected.push(`${file.name}: ${fileProblem}`)
      continue
    }
    items.value.push({
      id: nextId++,
      file,
      name: file.name,
      size: file.size,
      status: 'queued',
      progress: 0,
      key: '',
      error: '',
      previewUrl: URL.createObjectURL(file),
      durationSeconds: null,
      title: titleFromFileName(file.name)
    })
  }
  if (rejected.length) errors.value.audio = rejected.join(' · ')
  pump()
}
function onPickFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) addFiles(files)
}
function onDrop(event: DragEvent) {
  dragging.value = false
  const files = Array.from(event.dataTransfer?.files ?? [])
  if (files.length) addFiles(files)
}

/** Uploads one file at a time so a big batch doesn't compete with itself. */
async function pump() {
  const i = nextToUpload(items.value.map((x) => x.status))
  if (i === null) return
  const item = items.value[i]!
  if (!item.file) return
  item.status = 'uploading'
  item.progress = 0
  if (!previewFile.value && item.file.size <= MAX_PREVIEW_BYTES) previewFile.value = item.file
  try {
    const [seconds, ticket] = await Promise.all([readDuration(item.file), videos.requestUpload('AUDIO', item.file)])
    item.durationSeconds = seconds
    await uploadToStorage(ticket, item.file, (f) => (item.progress = f))
    item.key = ticket.key
    item.status = 'ready'
    item.file = null
  } catch (err) {
    item.status = 'error'
    item.error = `Could not upload: ${apiErrorMessage(err)}`
  }
  pump()
}
function retryItem(id: number) {
  const item = items.value.find((i) => i.id === id)
  if (!item) return
  item.status = 'queued'
  item.error = ''
  pump()
}
function removeItem(id: number) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i === -1) return
  // The preview was drawn from the first file; with it gone, it is only a sketch again.
  if (i === 0) previewFile.value = null
  URL.revokeObjectURL(items.value[i]!.previewUrl)
  items.value.splice(i, 1)
}

// ── The pictures ─────────────────────────────────────────────────────────────
let nextSlideId = 1
async function onPickPictures(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  errors.value.cover = ''
  const room = MAX_SLIDES - slides.value.length
  if (files.length > room) errors.value.cover = `At most ${MAX_SLIDES} pictures; the first ${room} were used`
  const rejected: string[] = []
  picUploading.value = true
  try {
    // One at a time, in the order chosen, so each gets the next time slot.
    for (const file of files.slice(0, Math.max(0, room))) {
      const problem = coverFileProblem(file)
      if (problem) {
        rejected.push(`${file.name}: ${problem}`)
        continue
      }
      picProgress.value = 0
      try {
        const ticket = await videos.requestUpload('OVERLAY', file)
        await uploadToStorage(ticket, file, (f) => (picProgress.value = f))
        slides.value.push({
          id: nextSlideId++,
          key: ticket.key,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          startMs: nextSlideStart(slideStarts.value, shortestSeconds.value)
        })
      } catch (err) {
        rejected.push(`${file.name}: could not upload (${apiErrorMessage(err)})`)
      }
    }
  } finally {
    picUploading.value = false
  }
  if (rejected.length) errors.value.cover = [errors.value.cover, ...rejected].filter(Boolean).join(' · ')
}

/** Typed times ("1:23", "1:23.5"); a value that isn't a time puts the old one back. */
function typeStart(id: number, event: Event) {
  const slide = slides.value.find((sl) => sl.id === id)
  const input = event.target as HTMLInputElement
  if (!slide) return
  const ms = parseTimecode(input.value)
  if (ms === null) toast.add({ title: 'Not a time', description: 'Type it like 1:23 or 1:23.5.', color: 'warning' })
  else slide.startMs = ms
  input.value = formatTimecode(slide.startMs)
}
function movePicture(index: number, by: -1 | 1) {
  slides.value = swapContents(slides.value, index, index + by)
}
function removeSlide(id: number) {
  const i = slides.value.findIndex((sl) => sl.id === id)
  if (i === -1) return
  URL.revokeObjectURL(slides.value[i]!.previewUrl)
  const rest = slides.value.filter((sl) => sl.id !== id)
  // Every other picture keeps its own time. If the first one went, the next one becomes the first, which starts at 0:00.
  slides.value = rest.map((sl, n) => (n === 0 ? { ...sl, startMs: 0 } : sl))
}
function spread() {
  const starts = spreadStarts.value
  if (starts) slides.value = slides.value.map((sl, i) => ({ ...sl, startMs: starts[i]! }))
}
onBeforeUnmount(() => {
  items.value.forEach((i) => URL.revokeObjectURL(i.previewUrl))
  slides.value.forEach((sl) => URL.revokeObjectURL(sl.previewUrl))
})

// ── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  errors.value = {}
  saveError.value = ''
  if (!readyItems.value.length) {
    errors.value.audio = 'Choose the audio first'
    return
  }
  if (requireCategory.value && !categoryIds.value.length) errors.value.categoryIds = 'Choose at least one category'
  if (categoryIds.value.length > maxCategories.value) errors.value.categoryIds = `At most ${maxCategories.value}`
  if (transcribe.value && !language.value) errors.value.language = 'Choose the spoken language to transcribe'
  if (Object.keys(errors.value).length) return

  saving.value = true
  const chosen = readyItems.value
  const titles = uniqueTitles(chosen.map((i) => i.title.trim()))
  const made: { id: number; jobId: number; title: string }[] = []
  const failed: string[] = []
  try {
    // One at a time and in order, so a collection ends up in the order the files were added.
    for (let i = 0; i < chosen.length; i++) {
      try {
        const result = await videos.createFromAudio({
          audioKey: chosen[i]!.key,
          coverKey: slides.value.length === 1 ? slides.value[0]!.key : undefined,
          slides: slides.value.length > 1 ? slides.value.map((sl) => ({ key: sl.key, startMs: sl.startMs })) : undefined,
          background: background.value,
          resolution: resolution.value,
          waveform: waveform.value,
          waveColor: waveform.value !== 'NONE' && !waveAuto.value ? waveColor.value : undefined,
          titleCard: titleCard.value && !slides.value.length ? true : undefined,
          normalize: normalize.value || undefined,
          denoise: denoise.value || undefined,
          transcribe: transcribe.value || undefined,
          title: titles[i]!,
          description: description.value.trim() || undefined,
          language: language.value,
          categoryIds: categoryIds.value
        })
        made.push({ id: result.video.id, jobId: result.job.id, title: titles[i]! })
      } catch (err) {
        failed.push(`${titles[i]}: ${apiErrorMessage(err)}`)
        if (chosen.length === 1) throw err
      }
    }

    if (collectionId.value && made.length) {
      try {
        await collections.addVideos(
          collectionId.value,
          made.map((m) => m.id)
        )
      } catch (err) {
        toast.add({ title: 'Made the videos, but could not add them to the collection', description: apiErrorMessage(err), color: 'warning' })
      }
    }
  } catch (err) {
    saveError.value = apiErrorMessage(err)
    saving.value = false
    return
  }
  saving.value = false

  if (!made.length) {
    saveError.value = failed.join(' · ')
    return
  }
  submitted.value = true
  if (failed.length) {
    toast.add({ title: `${made.length} of ${chosen.length} videos are being made`, description: failed.join(' · '), color: 'warning' })
  } else {
    toast.add({
      title: made.length === 1 ? 'Making the video' : `Making ${made.length} videos`,
      description: 'You can leave; it keeps going in the background.',
      color: 'success'
    })
  }
  // One video: go to it (it shows the progress). Several: the list, where they show up hidden.
  await navigateTo(made.length === 1 ? `/videos/${made[0]!.id}` : '/videos')
}

useUnsavedChangesGuard(() => !submitted.value && (items.value.length > 0 || slides.value.length > 0 || picUploading.value))

// Each step has its own colour (shared with the editor's tabs): a numbered badge,
// a tinted header, and — through the scope class — its own accent for the
// selected buttons, switches and focus rings inside the card.
const STEP_TONES = {
  1: { scope: TAB_ACCENTS.audio.scope, badge: TAB_ACCENTS.audio.button, header: 'bg-emerald-50/70 dark:bg-emerald-950/30' },
  2: { scope: TAB_ACCENTS.split.scope, badge: TAB_ACCENTS.split.button, header: 'bg-violet-50/70 dark:bg-violet-950/30' },
  3: { scope: TAB_ACCENTS.trim.scope, badge: TAB_ACCENTS.trim.button, header: 'bg-sky-50/70 dark:bg-sky-950/30' },
  4: { scope: TAB_ACCENTS.join.scope, badge: TAB_ACCENTS.join.button, header: 'bg-orange-50/70 dark:bg-orange-950/30' }
} as const
</script>
