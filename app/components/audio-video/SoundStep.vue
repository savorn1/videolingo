<template>
  <AudioVideoStepCard :step="3" title="Sound">
    <!-- Grouped into headed sections, like The look -->
    <div class="space-y-5 divide-y divide-gray-100 dark:divide-gray-800">
      <section class="space-y-3 pt-5 first:pt-0" aria-labelledby="sound-cleanup">
        <h3 id="sound-cleanup" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-sparkles" class="size-4 text-gray-400" />Clean-up
        </h3>
        <USwitch v-model="normalize" label="Even out the loudness" description="Brings quiet and loud recordings to the same level." />
        <USwitch v-model="denoise" label="Reduce background noise" description="Softens steady hiss and hum. Voices can sound slightly processed." />
        <USwitch
          v-model="trimSilence"
          label="Trim the silence at the start and end"
          description="Takes off the quiet before the first sound and after the last."
        />
      </section>
      <section class="space-y-3 pt-5 first:pt-0" aria-labelledby="sound-music" data-testid="music">
        <h3 id="sound-music" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-music" class="size-4 text-gray-400" />Music under the recording
          <span class="font-normal text-gray-500 dark:text-gray-400">· optional</span>
        </h3>
        <div class="flex flex-wrap items-center gap-2">
          <UploadButton v-if="!music" label="Add music" accept="audio/*" :progress="musicUploading ? musicProgress : null" @pick="onPickMusic" />
          <template v-else>
            <UIcon name="i-lucide-file-audio" class="size-4 shrink-0 text-gray-400" />
            <span class="min-w-0 truncate text-sm text-gray-900 dark:text-white" :title="music.name">{{ music.name }}</span>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the music" @click="removeMusic" />
          </template>
        </div>
        <template v-if="music">
          <SliderRow
            label="Music volume"
            :model-value="Math.round(musicVolume * 100)"
            :min="0"
            :max="100"
            :step="5"
            :default-value="15"
            unit="%"
            @update:model-value="(v) => (musicVolume = v / 100)"
          />
          <USwitch v-model="musicDuck" label="Quieter while someone speaks" description="Dips the music under the voice and brings it back in the pauses." />
        </template>
        <p v-else class="text-xs text-gray-500 dark:text-gray-400">Plays softly under every recording, looped to the end.</p>
      </section>
      <section class="space-y-3 pt-5 first:pt-0" aria-labelledby="sound-long" data-testid="chapters">
        <h3 id="sound-long" class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
          <UIcon name="i-lucide-scissors" class="size-4 text-gray-400" />Long recordings
        </h3>
        <USwitch
          v-model="chapters"
          label="Split long recordings into parts"
          :description="`Recordings longer than ${Math.round(partMinutes * 1.5)} min become several videos, cut at a pause near every ${partMinutes} min.`"
        />
        <div v-if="chapters" class="flex items-center gap-2 pl-11 text-sm text-gray-700 dark:text-gray-300">
          Parts of about
          <UInput
            v-model.number="partMinutes"
            type="number"
            size="xs"
            :min="MIN_PART_MINUTES"
            :max="MAX_PART_MINUTES"
            class="w-20"
            aria-label="Minutes per part"
            @blur="commitPartMinutes"
          />
          minutes
        </div>
        <p v-if="chapters && longItems" class="pl-11 text-xs text-gray-500 dark:text-gray-400">
          {{ longItems }} recording{{ longItems === 1 ? '' : 's' }} will be split, making about {{ videoCount }} videos in all; each part is titled “… — Part 2
          of 3”.
        </p>
        <p v-else-if="chapters && readyItems.length" class="pl-11 text-xs text-gray-500 dark:text-gray-400">
          No recording is long enough to split at this length.
        </p>
      </section>
    </div>
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 3 of "Video from audio": loudness, noise, silence trimming, music under the recording and splitting long recordings.
import { MAX_PART_MINUTES, MIN_PART_MINUTES } from '#shared/utils/audioVideo'
const {
  normalize,
  denoise,
  trimSilence,
  chapters,
  partMinutes,
  longItems,
  videoCount,
  commitPartMinutes,
  readyItems,
  music,
  musicUploading,
  musicProgress,
  musicVolume,
  musicDuck,
  onPickMusic,
  removeMusic
} = useAudioToVideoFormContext()
</script>
