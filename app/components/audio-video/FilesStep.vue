<template>
  <AudioVideoStepCard :step="1" title="The audio" :done="readyItems.length > 0">
    <template #aside>
      <span v-if="items.length > 1" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {{ items.length }} files<template v-if="readyItems.length"> → {{ videoCountLabel }} video{{ videoCount === 1 ? '' : 's' }}</template>
      </span>
    </template>
    <ul v-if="items.length" class="mb-3 divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
      <li v-for="(it, idx) in items" :key="it.id" class="space-y-2 px-3 py-2.5">
        <div class="flex items-center gap-3">
          <!-- Several files: a play button each (one plays at a time); a single file gets the full player below -->
          <UButton
            v-if="items.length > 1 && it.status === 'ready'"
            size="xs"
            color="neutral"
            variant="soft"
            :icon="playingId === it.id ? 'i-lucide-pause' : 'i-lucide-play'"
            :aria-label="playingId === it.id ? `Pause ${it.name}` : `Play ${it.name}`"
            :aria-pressed="playingId === it.id"
            @click="togglePlay(it)"
          />
          <UIcon v-else name="i-lucide-file-audio" class="h-5 w-5 shrink-0 text-primary-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="it.name">{{ it.name }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
              {{ formatFileSize(it.size) }}<template v-if="it.durationSeconds"> · {{ formatDuration(it.durationSeconds) }}</template>
              <template v-if="it.status === 'queued'"> · waiting</template>
              <template v-else-if="it.status === 'uploading'"> · uploading {{ Math.round(it.progress * 100) }}%</template>
            </p>
          </div>
          <!-- Its own picture: the cover art found in the file, or one chosen for it -->
          <img
            v-if="it.coverUrl"
            :src="it.coverUrl"
            alt=""
            class="size-9 shrink-0 rounded object-cover ring-1 ring-gray-200 dark:ring-gray-700"
            :title="it.coverFromFile ? 'Cover art from the file' : 'Its own picture'"
          />
          <UBadge v-if="it.status === 'ready'" color="success" variant="subtle" size="sm" icon="i-lucide-check">Uploaded</UBadge>
          <!-- The order is the order the videos are made (and added to a collection) -->
          <div v-if="items.length > 1" class="flex shrink-0 items-center">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-up"
              :aria-label="`Move ${it.name} up`"
              :disabled="saving || idx === 0"
              @click="moveItem(idx, -1)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-down"
              :aria-label="`Move ${it.name} down`"
              :disabled="saving || idx === items.length - 1"
              @click="moveItem(idx, 1)"
            />
          </div>
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
        <div v-if="it.status !== 'error'" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <template v-if="it.coverKey">
            <span>{{ it.coverFromFile ? 'Uses the cover art from the file' : 'Uses its own picture' }} instead of the shared pictures.</span>
            <UButton size="xs" color="neutral" variant="link" :padded="false" @click="clearItemPicture(it.id)">Remove</UButton>
          </template>
          <label class="cursor-pointer text-primary-700 underline-offset-2 hover:underline dark:text-primary-400">
            {{ it.coverUploading ? 'Uploading the picture…' : it.coverKey ? 'Change the picture' : 'Give it its own picture' }}
            <input
              type="file"
              class="sr-only"
              accept="image/png,image/jpeg,image/webp"
              :aria-label="`Picture for ${it.name}`"
              @change="(e) => onPickItemPicture(it.id, e)"
            />
          </label>
        </div>
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
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 1 of "Video from audio": the recordings, each with its title and (optionally) its own picture.
import { MAX_BATCH } from '#shared/utils/audioVideo'
const {
  maxUploadMb,
  items,
  errors,
  saving,
  videoCount,
  videoCountLabel,
  readyItems,
  onPickFiles,
  retryItem,
  removeItem,
  moveItem,
  playingId,
  togglePlay,
  onPickItemPicture,
  clearItemPicture
} = useAudioToVideoFormContext()
</script>
