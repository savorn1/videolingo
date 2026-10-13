<template>
  <div class="space-y-4">
    <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
    <!-- Shown once: how the editor works, in one line. -->
    <div
      v-if="showTip"
      class="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
      data-testid="editor-tip"
    >
      <UIcon name="i-lucide-lightbulb" class="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
      <ol class="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1">
        <li><strong>1.</strong> Pick a tool</li>
        <li><strong>2.</strong> Change its settings</li>
        <li><strong>3.</strong> Render</li>
        <li><strong>4.</strong> Add the result as a new video, or replace the original — your original is kept either way</li>
      </ol>
      <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Hide this tip" @click="dismissTip" />
    </div>
    <UAlert
      v-if="draft"
      color="info"
      variant="subtle"
      icon="i-lucide-history"
      :title="`You have unrendered edits from ${formatRelativeTime(new Date(draft.savedAt).toISOString())}`"
      description="They were kept in this browser. Restore them, or start fresh."
      data-testid="draft-notice"
    >
      <template #actions>
        <UButton size="xs" color="info" @click="onRestoreDraft">Restore</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="confirmDiscardDraft = true">Discard</UButton>
      </template>
    </UAlert>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <!-- Preview (large, stays in view while scrolling the controls) -->
      <!-- The stage is what goes full screen, so crop, zoom and the playback bar come along. -->
      <div
        ref="stage"
        data-testid="preview-stage"
        class="xl:col-span-2 xl:sticky xl:top-4 space-y-2"
        :class="stageFullscreen ? 'dark bg-black p-4 flex flex-col justify-center' : ''"
      >
        <!-- Zoomable preview: scroll over it to zoom toward the pointer; when
             zoomed, Space+drag / middle-drag pans. A plain drag crops. -->
        <div
          ref="zoomBox"
          data-testid="preview-zoom"
          class="group relative rounded-lg overflow-hidden bg-black"
          :class="panning ? 'cursor-grabbing' : zoom > 1 && spaceHeld ? 'cursor-grab' : ''"
          :style="fitStyle"
          @wheel="onPreviewWheel"
          @pointerdown.capture="onPanStart"
          @pointerdown="onQuickCropStart"
          @pointerenter="hovering = true"
          @pointerleave="hovering = false"
        >
          <div :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }">
            <!-- A turn or flip shows live here (only while no crop is being drawn, since the crop is on the original picture) -->
            <div
              class="transition-transform duration-200 motion-reduce:transition-none"
              :style="previewOrientStyle"
              :data-orient="previewOriented ? 'on' : undefined"
            >
              <VideoPlayer
                ref="preview"
                :video-url="video.videoUrl"
                :poster="video.thumbnailUrl"
                :title="video.title"
                read-duration
                @time="onTime"
                @duration="onDuration"
              >
                <template v-if="cropActive || overlayEdit.state.layers.length || mode === 'overlay' || showGuides || lookCompareShown" #overlay>
                  <LookCompare v-if="lookCompareShown && !cropActive" :video-el="preview?.videoEl" />
                  <OverlayLayers
                    v-if="mode === 'overlay' || overlayEdit.state.layers.length"
                    :readonly="mode !== 'overlay'"
                    :edit="overlayEdit"
                    :natural-width="naturalWidth"
                    :natural-height="naturalHeight"
                    :current-ms="currentMs"
                    :duration-ms="durationMs"
                    :zoom="zoom"
                  />
                  <div
                    v-if="showGuides && guideBox"
                    class="pointer-events-none absolute z-10"
                    :style="guideBox.style"
                    data-testid="safe-guide"
                    aria-hidden="true"
                  >
                    <div class="absolute rounded-sm border border-dashed border-emerald-300/90 bg-emerald-400/10" :style="guideBox.safe" />
                    <span class="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-emerald-200">{{ guideBox.label }}</span>
                  </div>
                  <CropOverlay
                    v-if="mode !== 'overlay' && cropActive"
                    ref="cropLayer"
                    :model-value="crop"
                    :natural-width="naturalWidth"
                    :natural-height="naturalHeight"
                    :aspect="cropAspect"
                    :zoom="zoom"
                    @update:model-value="(v) => Object.assign(crop, v)"
                  />
                </template>
              </VideoPlayer>
            </div>
          </div>

          <p
            v-if="orientActive && cropActive"
            class="pointer-events-none absolute bottom-2 left-2 z-20 rounded bg-black/70 px-2 py-1 text-[11px] text-white"
            data-testid="orient-note"
          >
            Crop is drawn on the original — {{ describeOrientation(orient) }} comes after
          </p>
          <div
            class="absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-md bg-black/70 px-1 py-0.5 text-white transition-opacity"
            :class="zoom > 1 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15"
              :class="showGuides ? 'bg-emerald-500/40' : ''"
              :aria-pressed="showGuides"
              title="Safe-area guide: where Shorts, Reels and TikTok keep clear for their own buttons"
              aria-label="Safe-area guide"
              @click="showGuides = !showGuides"
            >
              <UIcon name="i-lucide-frame" class="w-4 h-4 block" />
            </button>
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom out"
              :disabled="zoom <= 1"
              @click="zoomBy(1 / 1.25)"
            >
              <UIcon name="i-lucide-zoom-out" class="w-4 h-4 block" />
            </button>
            <button
              type="button"
              class="px-1 text-xs font-medium tabular-nums min-w-11 rounded hover:bg-white/15"
              title="Reset zoom (scroll over the video to zoom)"
              @click="resetZoom"
            >
              {{ Math.round(zoom * 100) }}%
            </button>
            <button
              type="button"
              class="p-1 rounded hover:bg-white/15 disabled:opacity-40"
              aria-label="Zoom in"
              :disabled="zoom >= MAX_ZOOM"
              @click="zoomBy(1.25)"
            >
              <UIcon name="i-lucide-zoom-in" class="w-4 h-4 block" />
            </button>
          </div>
        </div>
        <EditorTransport
          :player="preview"
          :selection="mode === 'trim' ? range : mode === 'audio' ? audioEdit.state.range : null"
          :selection-editable="mode === 'trim'"
          :cuts="mode === 'trim' ? cuts : []"
          @update:cuts="(c: CutRange[]) => (cuts = c)"
          @update:selection="(r: [number, number]) => (range = r)"
          :fullscreen-target="stage"
          :space-taken="hovering && zoom > 1"
          :arrow-keys-taken="mode === 'overlay' && !!overlayEdit.state.selectedId"
          :style="fitStyle"
        />
        <AudioStrip
          v-if="mode === 'audio'"
          :edit="audioEdit"
          :video-id="video.id"
          :duration-ms="durationMs"
          :current-ms="currentMs"
          :style="fitStyle"
          @seek="(ms: number) => preview?.seek(ms, false)"
        />
        <p v-if="!stageFullscreen && tabKeysHint" class="text-xs text-gray-500 dark:text-gray-400" data-testid="tab-keys-hint">
          <UIcon name="i-lucide-keyboard" class="w-3 h-3 inline align-text-top" /> {{ tabKeysHint }}
        </p>
        <p v-if="!stageFullscreen" class="text-xs text-gray-500 dark:text-gray-400">
          Drag on the video to crop · scroll over it to zoom · more shortcuts under
          <UIcon name="i-lucide-keyboard" class="w-3 h-3 inline align-text-top" /> above, or press <UKbd value="?" />
        </p>
      </div>

      <!-- Controls -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <!-- The tile takes the colour of the tool that is open, so the header says which one it is -->
              <span class="flex size-6 items-center justify-center rounded-md transition-colors" :class="TAB_ACCENTS[mode].soft">
                <UIcon name="i-lucide-sliders-horizontal" class="size-3.5" />
              </span>
              Edit
              <UBadge
                v-if="runningCount"
                size="sm"
                color="info"
                variant="subtle"
                icon="i-lucide-loader"
                :ui="{ leadingIcon: 'animate-spin motion-reduce:animate-none' }"
                data-testid="running-chip"
              >
                {{ runningCount }} running
              </UBadge>
            </h2>
            <div class="flex items-center gap-1">
              <span
                v-if="history.draftSavedAt.value"
                class="mr-1 hidden items-center gap-1 text-xs text-gray-500 dark:text-gray-400 sm:flex"
                data-testid="draft-saved"
                aria-live="polite"
              >
                <UIcon name="i-lucide-cloud-check" class="size-3.5" />
                Draft saved {{ draftSavedLabel }}
              </span>
              <UPopover v-model:open="recipesOpen">
                <UButton size="xs" color="neutral" variant="soft" :class="HEADER_TONES.recipes" icon="i-lucide-chef-hat" title="Reuse a look on this video"
                  >Recipes</UButton
                >
                <template #content>
                  <div class="w-80 space-y-3 p-3">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      A recipe keeps the crop shape and size, the sound settings and the text layers — not the trim, splits or sound clips, which belong to one
                      video.
                    </p>
                    <ul
                      v-if="recipes.saved.value.length"
                      class="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
                    >
                      <li v-for="r in recipes.saved.value" :key="r.id" class="flex items-center gap-2 px-2.5 py-2">
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ r.name }}</p>
                          <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ describeRecipe(r.data) }}</p>
                        </div>
                        <UButton size="xs" color="neutral" :class="TAB_ACCENTS.trim.button" @click="applyRecipe(r.data, r.name)">Apply</UButton>
                        <UButton
                          size="xs"
                          color="error"
                          variant="ghost"
                          icon="i-lucide-x"
                          :aria-label="`Delete recipe ${r.name}`"
                          @click="recipes.remove(r.id)"
                        />
                      </li>
                    </ul>
                    <p v-else class="text-xs text-gray-500 dark:text-gray-400">No recipes yet.</p>
                    <form class="space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800" @submit.prevent="onSaveRecipe">
                      <UFormField label="Save the current settings" :hint="currentRecipe ? describeRecipe(currentRecipe) : undefined">
                        <div class="flex items-center gap-2">
                          <UInput
                            v-model="recipeName"
                            size="sm"
                            class="min-w-0 flex-1"
                            placeholder="e.g. Reel look"
                            :maxlength="40"
                            :disabled="!currentRecipe"
                            aria-label="Recipe name"
                          />
                          <UButton type="submit" size="sm" icon="i-lucide-bookmark-plus" :disabled="!currentRecipe || !recipeName.trim()">Save</UButton>
                        </div>
                      </UFormField>
                      <p v-if="!currentRecipe" class="text-xs text-gray-500 dark:text-gray-400">
                        Set a crop and size, change the sound or add a text layer first.
                      </p>
                    </form>
                  </div>
                </template>
              </UPopover>
              <UButton
                size="xs"
                color="neutral"
                :variant="history.undoable.value ? 'soft' : 'ghost'"
                :class="history.undoable.value ? HEADER_TONES.history : ''"
                icon="i-lucide-undo-2"
                :disabled="!history.undoable.value"
                title="Undo (Ctrl/⌘+Z)"
                @click="history.undo()"
              >
                Undo
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                :variant="history.redoable.value ? 'soft' : 'ghost'"
                :class="history.redoable.value ? HEADER_TONES.history : ''"
                icon="i-lucide-redo-2"
                :disabled="!history.redoable.value"
                title="Redo (Ctrl/⌘+Shift+Z)"
                @click="history.redo()"
              >
                Redo
              </UButton>
              <ShortcutsHelp :items="EDITOR_SHORTCUTS" />
            </div>
          </div>
        </template>
        <!-- Short labels + stacked icons so all four tabs fit the narrow panel; the full names are in the tooltip. -->
        <UTabs
          v-model="mode"
          :items="tabItems"
          variant="pill"
          :ui="{ list: 'mb-4', trigger: 'flex-1 flex-col gap-1 px-1 text-xs', leadingIcon: 'size-5', label: 'truncate', indicator: TAB_TONES[mode].indicator }"
        >
          <!-- ── Trim & crop ───────────────────────────────────────────── -->
          <template #trim>
            <ClipEditorTrimTab />
          </template>

          <!-- ── Split into segments ──────────────────────────────────────── -->
          <template #split>
            <ClipEditorSplitTab />
          </template>
          <!-- ── Audio ─────────────────────────────────────────────────── -->
          <template #overlay>
            <OverlayPanel
              :class="TAB_ACCENTS.overlay.scope"
              :edit="overlayEdit"
              :video-id="video.id"
              :duration-ms="durationMs"
              :current-ms="currentMs"
              :can-write="canWrite"
              :busy="busy"
              @queued="onQueued"
              @preview="(ms: number, play?: boolean) => preview?.seek(ms, play ?? true)"
            />
          </template>

          <template #audio>
            <AudioEditPanel
              :class="TAB_ACCENTS.audio.scope"
              :edit="audioEdit"
              :video-id="video.id"
              :duration-ms="durationMs"
              :current-ms="currentMs"
              :can-write="canWrite"
              :busy="busy"
              @queued="onQueued"
            />
          </template>

          <template #join>
            <JoinPanel :class="TAB_ACCENTS.join.scope" :video="video" :edit="joinEdit" :can-write="canWrite" />
          </template>
        </UTabs>
      </UCard>
    </div>

    <!-- Results: jobs in progress (or the latest failure), then clips awaiting a decision -->
    <ClipEditorResultsCard />

    <ClipPreviewModal
      :open="previewClip !== null"
      :clip="previewClip"
      :title="previewClip ? clipTitle(previewClip) : ''"
      :can-write="canWrite"
      :replaces="previewClip ? replaces(previewClip) : false"
      :can-compare="!!video.videoUrl"
      :poster="video.thumbnailUrl"
      @update:open="(v: boolean) => !v && (previewClip = null)"
      @add-new="onPreviewAddNew"
      @replace="previewClip && (confirmPromote = previewClip)"
      @compare="previewClip && (compareClip = previewClip)"
      @discard="previewClip && (confirmDiscardClip = previewClip)"
    />

    <ClipCompareModal
      :open="compareClip !== null"
      :clip="compareClip"
      :original-url="video.videoUrl"
      @update:open="(v: boolean) => !v && (compareClip = null)"
    />

    <ConfirmModal
      :model-value="confirmBulkDiscard"
      :title="`Discard ${pickedClips.length} result${pickedClips.length === 1 ? '' : 's'}?`"
      description="The rendered files are deleted, and they can't be replaced or added as videos afterwards. Your original video is not affected."
      confirm-label="Discard"
      color="error"
      :loading="bulkBusy"
      @update:model-value="(v: boolean) => (confirmBulkDiscard = v)"
      @confirm="onBulkDiscard"
    />

    <UModal
      :open="asNewClip !== null"
      title="Add as a new video"
      description="Makes a separate video from this result. Your original video is not changed, and the new one stays hidden until you enable it."
      @update:open="(v: boolean) => !v && !creatingNew && (asNewClip = null)"
    >
      <template #body>
        <form id="as-new-form" class="space-y-3" @submit.prevent="onCreateNew">
          <UFormField label="Title" required>
            <UInput v-model="asNewTitle" maxlength="200" class="w-full" autofocus aria-label="Title of the new video" />
          </UFormField>
        </form>
      </template>
      <template #footer="{ close }">
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="creatingNew" @click="close">Cancel</UButton>
          <UButton type="submit" form="as-new-form" icon="i-lucide-copy-plus" :loading="creatingNew" :disabled="!asNewTitle.trim()">Create video</UButton>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmPromote !== null"
      :title="confirmPromote && replaces(confirmPromote) ? 'Replace the original video' : 'Add as a new video'"
      :description="
        confirmPromote && replaces(confirmPromote)
          ? `This replaces the video's current file with ${confirmPromote.operation === 'AUDIO' ? 'the version with the edited sound' : confirmPromote.operation === 'OVERLAY' ? 'the version with the text & overlays' : 'this trimmed/cropped clip'}. The current file is kept under Versions, so you can restore it.`
          : 'Creates a new, disabled video from this segment — review it before enabling it for learners.'
      "
      :confirm-label="confirmPromote && replaces(confirmPromote) ? 'Replace original' : 'Add as new video'"
      :color="confirmPromote && replaces(confirmPromote) ? 'warning' : 'primary'"
      :loading="promoting"
      @update:model-value="(v: boolean) => !v && !promoting && (confirmPromote = null)"
      @confirm="onPromote"
    />

    <ConfirmModal
      :model-value="confirmDiscardClip !== null"
      title="Discard this result"
      :description="`Discard “${confirmDiscardClip ? clipTitle(confirmDiscardClip) : ''}”? The rendered file is deleted, and it can't be replaced or added as a video afterwards. Your original video is not affected.`"
      confirm-label="Discard"
      color="error"
      @update:model-value="(v: boolean) => !v && (confirmDiscardClip = null)"
      @confirm="onConfirmDiscardClip"
    />

    <ConfirmModal
      :model-value="confirmDiscardDraft"
      title="Discard unrendered edits"
      description="These were only kept in this browser and haven't been rendered yet. Discarding them can't be undone."
      confirm-label="Discard"
      color="error"
      @update:model-value="(v: boolean) => (confirmDiscardDraft = v)"
      @confirm="onDiscardDraft"
    />
  </div>
</template>

<script setup lang="ts">
// The video editor (its own page, /videos/:id/editor): trim/crop/scale a
// range of a video, split it into segments, or edit its sound — all run as
// EDIT jobs (useVideoEdits), producing clips to preview, then promote (TRIM
// and AUDIO replace the video's file; SPLIT segments become new videos),
// download (extracted audio) or discard. Polls jobs
// while any are active, same pattern as VideoDownloadModal.
//
// The state and actions are in useClipEditor (app/composables/useClipEditor.ts); the Trim, Split and
// Results parts are components under app/components/clip-editor.
import type { Video } from '~/composables/useVideos'
import { describeOrientation } from '#shared/utils/videoEdit'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { describeRecipe } from '#shared/utils/editRecipe'

const props = defineProps<{ video: Video; canWrite: boolean }>()
const emit = defineEmits<{ replaced: []; created: [videoId: number] }>()

const {
  error,
  onQueued,
  mode,
  HEADER_TONES,
  tabKeysHint,
  EDITOR_SHORTCUTS,
  currentMs,
  durationMs,
  naturalWidth,
  naturalHeight,
  onTime,
  onDuration,
  MAX_ZOOM,
  zoom,
  pan,
  hovering,
  spaceHeld,
  panning,
  cropActive,
  lookCompareShown,
  showGuides,
  guideBox,
  zoomBy,
  resetZoom,
  onPreviewWheel,
  onPanStart,
  onQuickCropStart,
  stageFullscreen,
  fitStyle,
  range,
  crop,
  cropAspect,
  orient,
  orientActive,
  previewOriented,
  previewOrientStyle,
  cuts,
  busy,
  audioEdit,
  overlayEdit,
  joinEdit,
  TAB_TONES,
  runningCount,
  tabItems,
  draftSavedLabel,
  history,
  draft,
  onRestoreDraft,
  confirmDiscardDraft,
  onDiscardDraft,
  replaces,
  clipTitle,
  confirmPromote,
  promoting,
  onPromote,
  asNewClip,
  asNewTitle,
  creatingNew,
  onCreateNew,
  bulkBusy,
  confirmBulkDiscard,
  pickedClips,
  onBulkDiscard,
  compareClip,
  previewClip,
  onPreviewAddNew,
  showTip,
  dismissTip,
  recipes,
  recipesOpen,
  recipeName,
  currentRecipe,
  onSaveRecipe,
  applyRecipe,
  confirmDiscardClip,
  onConfirmDiscardClip,
  preview,
  stage,
  zoomBox,
  cropLayer
} = provideClipEditor(props, emit)
</script>
