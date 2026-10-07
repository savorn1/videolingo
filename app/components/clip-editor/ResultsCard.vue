<template>
  <UCard ref="resultsCard" :class="TAB_ACCENTS.audio.scope" :ui="{ body: 'space-y-3', header: TAB_ACCENTS.audio.header }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-list-checks" class="size-4" :class="TAB_ACCENTS.audio.icon" />
        <h2 class="font-semibold text-gray-900 dark:text-white">Results</h2>
        <UBadge v-if="data?.clips.length" color="neutral" variant="subtle" size="sm">{{ data.clips.length }}</UBadge>
        <AnimationSpeed v-if="visibleJobs.length" class="ml-auto" />
      </div>
    </template>

    <div
      v-for="job in visibleJobs"
      :key="job.id"
      class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2"
      :class="job.status === 'RUNNING' ? 'render-card text-gray-900 dark:text-white' : ''"
    >
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="font-medium text-gray-900 dark:text-white truncate">{{ jobLabel(job) }}</span>
        <div class="flex items-center gap-2">
          <UButton
            v-if="canCancel && isActiveJobStatus(job.status)"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-circle-stop"
            :loading="cancellingId === job.id"
            :aria-label="`Cancel ${jobLabel(job)}`"
            @click="onCancelJob(job)"
          >
            Cancel
          </UButton>
          <UButton
            v-if="canRetry && job.status === 'FAILED'"
            size="xs"
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-cw"
            :loading="retryingId === job.id"
            :disabled="busy"
            :aria-label="`Retry ${jobLabel(job)}`"
            data-testid="retry-job"
            @click="onRetryJob(job)"
          >
            Retry
          </UButton>
          <UButton size="xs" color="neutral" variant="link" :to="`/processing-jobs/${job.id}`" :padded="false">Job #{{ job.id }}</UButton>
        </div>
      </div>
      <RenderAnimation v-if="isActiveJobStatus(job.status)" :operation="jobOperation(job)" :status="job.status" />
      <JobProgress
        :status="job.status"
        :progress="job.progress"
        :current-step="job.status === 'FAILED' ? job.errorMessage : job.currentStep"
        :queue-position="job.queuePosition"
      />
    </div>

    <EmptyState
      v-if="!visibleJobs.length && !data?.clips.length"
      icon="i-lucide-clapperboard"
      title="Nothing yet"
      description="Start a trim, split or audio edit — the results appear here to preview, then replace the original or add as new videos."
      class="py-6"
    />

    <div v-if="canWrite && selectableClips.length > 1" class="flex flex-wrap items-center gap-2 text-sm">
      <UCheckbox :model-value="allClipsPicked" label="Select all" @update:model-value="pickAllClips" />
      <template v-if="pickedClips.length">
        <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{{ pickedClips.length }} selected</span>
        <UButton size="xs" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-copy-plus" :loading="bulkBusy" @click="onBulkAddAsNew"
          >Add as new videos</UButton
        >
        <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="bulkBusy" @click="confirmBulkDiscard = true">Discard</UButton>
      </template>
    </div>

    <ul v-if="data?.clips.length" class="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
      <li v-for="clip in data.clips" :key="clip.id" class="flex items-center gap-3 px-3 py-2" :class="freshClipIds.includes(clip.id) ? 'result-in' : ''">
        <UCheckbox
          v-if="canWrite && selectableClips.length > 1 && clip.operation !== 'EXTRACT'"
          :model-value="pickedClipIds.includes(clip.id)"
          :aria-label="`Select ${clipTitle(clip)}`"
          @update:model-value="(v: boolean | 'indeterminate') => pickClip(clip.id, v === true)"
        />
        <span
          class="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shrink-0"
        >
          <UIcon :name="CLIP_ICONS[clip.operation]" class="w-4 h-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ clipTitle(clip) }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            <template v-if="clip.summary">{{ clip.summary }} · </template>
            {{ formatFileSize(clip.sizeBytes) }}
            <template v-if="clip.crop"> · cropped {{ clip.crop.w }}×{{ clip.crop.h }}</template>
            <template v-if="clip.scale"> · resized {{ clip.scale.w }}×{{ clip.scale.h }}</template>
            · expires {{ formatTimeUntil(clip.expiresAt) }}
          </p>
          <audio v-if="clip.operation === 'EXTRACT'" :src="clip.url" controls preload="none" class="mt-1 h-8 w-full max-w-sm" />
        </div>
        <template v-if="clip.operation === 'EXTRACT'">
          <UButton size="xs" color="primary" variant="soft" icon="i-lucide-download" :href="clip.url" download>Download</UButton>
        </template>
        <template v-else>
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-play" @click="previewClip = clip">Preview</UButton>
          <UButton v-if="video.videoUrl" size="xs" color="neutral" variant="ghost" icon="i-lucide-columns-2" @click="compareClip = clip">Compare</UButton>
          <template v-if="canWrite">
            <!-- A trim, audio or overlay result can be kept as a separate video, leaving the original as it is -->
            <!-- The safe choice is the solid button; replacing (which asks to confirm) is the quieter one. -->
            <UButton v-if="replaces(clip)" size="xs" color="neutral" :class="TAB_ACCENTS.audio.button" icon="i-lucide-copy-plus" @click="openAsNew(clip)"
              >Add as new video</UButton
            >
            <UButton size="xs" :color="replaces(clip) ? 'warning' : 'primary'" :variant="replaces(clip) ? 'soft' : 'solid'" @click="confirmPromote = clip">
              {{ replaces(clip) ? 'Replace original' : 'Add as new video' }}
            </UButton>
          </template>
        </template>
        <UButton v-if="canWrite" size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" aria-label="Discard clip" @click="confirmDiscardClip = clip" />
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
// The editor's Results: jobs in progress (or the latest failure), then clips to preview, keep or discard.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { formatFileSize, formatTimeUntil } from '#shared/utils/format'
const {
  data,
  freshClipIds,
  visibleJobs,
  canCancel,
  canRetry,
  retryingId,
  onRetryJob,
  cancellingId,
  onCancelJob,
  busy,
  jobLabel,
  jobOperation,
  CLIP_ICONS,
  replaces,
  clipTitle,
  confirmPromote,
  openAsNew,
  pickedClipIds,
  bulkBusy,
  confirmBulkDiscard,
  selectableClips,
  pickedClips,
  allClipsPicked,
  pickClip,
  pickAllClips,
  onBulkAddAsNew,
  compareClip,
  previewClip,
  confirmDiscardClip,
  video,
  canWrite,
  resultsCard
} = useClipEditorContext()
</script>
