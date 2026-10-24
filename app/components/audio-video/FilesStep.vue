<template>
  <AudioVideoStepCard :step="1" title="The audio" :done="readyItems.length > 0">
    <template #aside>
      <span v-if="items.length > 1" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {{ items.length }} files<template v-if="readyItems.length"> → {{ videoCountLabel }} video{{ videoCount === 1 ? '' : 's' }}</template>
      </span>
    </template>
    <!-- Several files: put them in order and number their titles in one go -->
    <div v-if="items.length > 1" class="mb-2 flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400" data-testid="batch-tools">
      <span>Order</span>
      <UButton
        v-if="hasTracks"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-list-ordered"
        :disabled="saving"
        title="The track numbers written in the files; ones without go last"
        @click="orderItems('TRACK')"
        >By track number</UButton
      >
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-arrow-down-a-z" :disabled="saving" @click="orderItems('NAME')">By file name</UButton>
      <UPopover v-model:open="numberOpen">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-hash" :disabled="saving">Number the titles</UButton>
        <template #content>
          <div class="w-80 space-y-3 p-3" data-testid="number-titles">
            <UFormField label="Pattern" :error="patternProblem ?? undefined" description="{n} is the number ({nn} as 01, 02…), {title} the title.">
              <UInput v-model="pattern" size="sm" class="w-full font-mono" aria-label="Title pattern" />
            </UFormField>
            <div class="flex flex-wrap gap-1">
              <UButton
                v-for="p in TITLE_PATTERNS"
                :key="p"
                size="xs"
                :color="pattern === p ? 'primary' : 'neutral'"
                :variant="pattern === p ? 'soft' : 'ghost'"
                class="font-mono"
                @click="pattern = p"
                >{{ p }}</UButton
              >
            </div>
            <UFormField label="Start at">
              <UInput v-model.number="numberStart" type="number" size="sm" :min="0" :max="9999" class="w-24" aria-label="First number" />
            </UFormField>
            <p v-if="example" class="truncate text-xs text-gray-500 dark:text-gray-400" :title="example">
              First: <span class="text-gray-900 dark:text-white">{{ example }}</span>
            </p>
            <div class="flex justify-end">
              <UButton size="sm" :disabled="!!patternProblem" @click="applyNumbers">Number {{ titled.length }} titles</UButton>
            </div>
          </div>
        </template>
      </UPopover>
      <UPopover v-model:open="replaceOpen">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-replace" :disabled="saving">Find and replace</UButton>
        <template #content>
          <form class="w-72 space-y-3 p-3" data-testid="replace-titles" @submit.prevent="applyReplace">
            <UFormField label="Find">
              <UInput v-model="findText" size="sm" class="w-full" aria-label="Find in the titles" autofocus />
            </UFormField>
            <UFormField label="Replace with" description="Leave empty to take it out.">
              <UInput v-model="replaceText" size="sm" class="w-full" aria-label="Replace with" />
            </UFormField>
            <UCheckbox v-model="matchCase" size="sm" label="Match case" />
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ findText ? `In ${matching} of ${titled.length} titles.` : 'Changes every title it is in.' }}
            </p>
            <div class="flex justify-end">
              <UButton type="submit" size="sm" :disabled="!matching">Replace</UButton>
            </div>
          </form>
        </template>
      </UPopover>
    </div>
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
          :color="it.status === 'ready' && !it.title.trim() ? 'error' : undefined"
          :highlight="it.status === 'ready' && !it.title.trim()"
          :data-untitled="it.status === 'ready' && !it.title.trim() ? '' : undefined"
          :aria-invalid="it.status === 'ready' && !it.title.trim()"
          :aria-label="`Title for ${it.name}`"
          placeholder="Title (needed)"
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
          <UButton
            v-if="it.status === 'ready'"
            size="xs"
            color="neutral"
            variant="link"
            :padded="false"
            icon="i-lucide-list"
            :aria-label="`Chapters of ${it.name}`"
            @click="chaptersFor = it.id"
            >{{ it.chapters.length ? `Chapters (${it.chapters.length})` : 'Add chapters' }}</UButton
          >
        </div>
        <audio v-if="items.length === 1 && it.status === 'ready'" :src="it.previewUrl" controls preload="metadata" class="h-10 w-full" />
      </li>
    </ul>

    <label
      class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 text-center transition-colors hover:border-primary-400 hover:bg-primary-50/40 focus-within:border-primary-500 dark:border-gray-700 dark:hover:bg-primary-950/20"
      :class="items.length ? 'py-4' : 'py-10'"
    >
      <UIcon name="i-lucide-upload" class="text-gray-400" :class="items.length ? 'h-6 w-6' : 'h-8 w-8'" />
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
    <AudioVideoChaptersEditor
      v-if="editing"
      v-model="editing.chapters"
      :open="!!editing"
      :name="editing.title.trim() || editing.name"
      :duration-ms="editing.durationSeconds ? editing.durationSeconds * 1000 : null"
      @update:open="(on: boolean) => !on && (chaptersFor = null)"
    />
  </AudioVideoStepCard>
</template>

<script setup lang="ts">
// Step 1 of "Video from audio": the recordings, each with its title and (optionally) its own picture.
import { MAX_BATCH } from '#shared/utils/audioVideo'
import { numberTitles, replaceInTitles, TITLE_PATTERNS, titlePatternProblem } from '#shared/utils/audioVideoExtras'
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
  hasTracks,
  orderItems,
  numberItemTitles,
  replaceItemTitles,
  playingId,
  togglePlay,
  onPickItemPicture,
  clearItemPicture
} = useAudioToVideoFormContext()
// The recording whose chapters are being edited.
const chaptersFor = ref<number | null>(null)
const editing = computed(() => items.value.find((i) => i.id === chaptersFor.value) ?? null)

// "Number the titles": a pattern applied once, in the current order; the titles stay editable after.
const numberOpen = ref(false)
const pattern = ref<string>(TITLE_PATTERNS[1])
const numberStart = ref(1)
const titled = computed(() => items.value.filter((i) => i.status !== 'error'))
const start = computed(() => (Number.isFinite(numberStart.value) ? Math.max(0, Math.min(9999, Math.round(numberStart.value))) : 1))
const patternProblem = computed(() => titlePatternProblem(pattern.value))
const example = computed(() =>
  patternProblem.value || !titled.value.length
    ? ''
    : numberTitles(
        titled.value.map((i) => i.title.trim()),
        pattern.value,
        start.value
      )[0]
)
function applyNumbers() {
  numberItemTitles(pattern.value, start.value)
  numberOpen.value = false
}

// "Find and replace": across every title at once, counted before it is applied.
const toast = useToast()
const replaceOpen = ref(false)
const findText = ref('')
const replaceText = ref('')
const matchCase = ref(false)
const matching = computed(
  () =>
    replaceInTitles(
      titled.value.map((i) => i.title),
      findText.value,
      replaceText.value,
      matchCase.value
    ).changed
)
function applyReplace() {
  const n = replaceItemTitles(findText.value, replaceText.value, matchCase.value)
  replaceOpen.value = false
  toast.add({ title: `Changed ${n} title${n === 1 ? '' : 's'}`, color: 'success' })
}
</script>
