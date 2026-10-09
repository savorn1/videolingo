<template>
  <div class="space-y-5" :class="TAB_ACCENTS.trim.scope">
    <!-- Range -->
    <section class="space-y-3" aria-labelledby="trim-range-h">
      <div class="flex items-center justify-between gap-2">
        <h3 id="trim-range-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.trim.heading">Range</h3>
        <UButton
          v-if="trimDirty"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          title="Undoable — Ctrl/⌘+Z brings the settings back"
          @click="resetTrim"
        >
          Reset trim
        </UButton>
      </div>
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Clip length</p>
          <p class="text-2xl font-semibold tabular-nums text-gray-900 dark:text-white" data-testid="clip-length">
            {{ formatMsShort(range[1] - range[0]) }}
          </p>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 tabular-nums text-right">
          {{ formatMsShort(range[0]) }} – {{ formatMsShort(range[1]) }}<br />
          of {{ formatMsShort(durationMs) }}
        </p>
      </div>
      <USlider
        v-model="range"
        :min="0"
        :max="Math.max(trimLimit, 1)"
        :step="100"
        :min-steps-between-thumbs="500"
        :ui="{ thumb: 'size-5' }"
        aria-label="Trim range"
      />
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div v-for="edge in TRIM_EDGES" :key="edge.key" class="space-y-1">
          <label :for="`trim-${edge.key}`" class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ edge.label }}</label>
          <div class="flex items-center gap-1">
            <UButton size="xs" color="neutral" variant="soft" aria-label="1 second earlier" @click="nudgeEdge(edge.key, -1000)">−1s</UButton>
            <UInput
              :id="`trim-${edge.key}`"
              :model-value="formatTimecode(range[edge.key === 'start' ? 0 : 1])"
              size="sm"
              class="flex-1 min-w-0"
              :ui="{ base: 'tabular-nums text-center' }"
              inputmode="decimal"
              @change="(e: Event) => typeEdge(edge.key, e)"
              @keydown.enter="(e: KeyboardEvent) => (e.target as HTMLInputElement).blur()"
            />
            <UButton size="xs" color="neutral" variant="soft" aria-label="1 second later" @click="nudgeEdge(edge.key, 1000)">+1s</UButton>
          </div>
          <UButton size="xs" color="neutral" variant="link" icon="i-lucide-crosshair" :padded="false" @click="setEdge(edge.key, Math.round(currentMs))">
            Use current time
          </UButton>
        </div>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">Type a time like 1:23.5, or step by single frames with ← → under the video.</p>
      <USwitch v-model="extendOn" size="xs" label="Extend past the end of the video" data-testid="trim-extend" />
      <p v-if="extendOn" class="text-xs text-gray-500 dark:text-gray-400">
        Set the end later than the video ({{ formatMsShort(durationMs) }}) — up to {{ MAX_EXTEND_MS / 60000 }} min more. The extra time holds the last frame,
        with silence.
        <span v-if="extension" class="font-medium text-gray-700 dark:text-gray-300">Adds {{ formatMsShort(extension) }}.</span>
      </p>
    </section>

    <!-- Output -->
    <section class="space-y-3" aria-labelledby="trim-output-h">
      <h3 id="trim-output-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.trim.heading">Output</h3>
      <div>
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">Export for</p>
          <USwitch v-model="multiExport" size="xs" label="Several formats at once" @update:model-value="multiKeys = []" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Export presets">
          <div v-for="p in EXPORT_PRESETS" :key="p.key" class="group relative">
            <button
              type="button"
              :aria-pressed="isPresetOn(p)"
              class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary-500"
              :class="
                isPresetOn(p)
                  ? [presetTone(p).active, 'ring-1']
                  : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
              "
              @click="onPresetClick(p)"
            >
              <span class="relative flex size-8 shrink-0 items-center justify-center rounded-md" :class="presetTone(p).icon">
                <UIcon :name="p.icon" class="w-4 h-4" />
                <UIcon
                  v-if="multiExport && isPresetOn(p)"
                  name="i-lucide-circle-check"
                  class="absolute -right-1 -top-1 size-4 rounded-full bg-white dark:bg-gray-900"
                />
              </span>
              <span class="min-w-0" :class="p.customId ? 'pr-14' : ''">
                <span class="block text-sm font-medium truncate" :title="p.label">{{ p.label }}</span>
                <span class="block text-xs opacity-70 tabular-nums">{{ p.ratio }} · {{ p.w }}×{{ p.h }}</span>
              </span>
            </button>
            <div
              v-if="p.customId"
              class="absolute right-1 top-1 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <UPopover :open="renamingId === p.customId" @update:open="(o: boolean) => (o ? startRename(p) : (renamingId = null))">
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" :aria-label="`Rename preset ${p.label}`" />
                <template #content>
                  <form class="w-64 space-y-2 p-3" @submit.prevent="onRenamePreset(p)">
                    <UFormField label="Rename preset" :hint="`${renameText.length}/${MAX_PRESET_NAME}`">
                      <UInput ref="renameInput" v-model="renameText" size="sm" class="w-full" :maxlength="MAX_PRESET_NAME" aria-label="New preset name" />
                    </UFormField>
                    <p v-if="renameClash(p)" class="text-xs text-warning-600 dark:text-warning-400">Taken — it will be “{{ renameClash(p) }}”.</p>
                    <div class="flex justify-end gap-1.5">
                      <UButton size="sm" color="neutral" variant="ghost" @click="renamingId = null">Cancel</UButton>
                      <UButton size="sm" type="submit" icon="i-lucide-check" color="neutral" :class="TAB_ACCENTS.trim.button" :disabled="!renameText.trim()"
                        >Save</UButton
                      >
                    </div>
                  </form>
                </template>
              </UPopover>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Delete preset ${p.label}`" @click="removePreset(p)" />
            </div>
          </div>
        </div>
        <div
          v-if="multiExport"
          class="mt-2 space-y-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2.5 dark:border-sky-900 dark:bg-sky-950/40"
          data-testid="multi-export"
        >
          <p class="text-xs text-sky-800 dark:text-sky-200">{{ multiSummary }}</p>
          <UButton
            v-if="canWrite"
            size="sm"
            block
            color="neutral"
            icon="i-lucide-layers"
            :class="TAB_ACCENTS.trim.button"
            :loading="startingMulti"
            :disabled="!!multiError || starting"
            @click="onStartMulti"
          >
            Queue {{ multiKeys.length }} export{{ multiKeys.length === 1 ? '' : 's' }}
          </UButton>
          <p v-if="multiError && multiKeys.length" class="text-xs text-error-600 dark:text-error-400">{{ multiError }}</p>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <UPopover v-model:open="savingPreset">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-bookmark-plus"
              :class="presetToSave ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900' : ''"
              :disabled="!presetToSave"
              @click="openSavePreset"
            >
              Save as preset
            </UButton>
            <template #content>
              <form class="w-72 space-y-2.5 p-3" @submit.prevent="onSavePreset">
                <div
                  v-if="presetToSave"
                  class="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
                    <UIcon name="i-lucide-bookmark" class="w-4 h-4" />
                  </span>
                  <span class="tabular-nums font-medium">{{ ratioLabel(presetToSave.aspect) }} · {{ presetToSave.w }}×{{ presetToSave.h }}</span>
                </div>
                <UFormField label="Name" :hint="`${presetName.length}/${MAX_PRESET_NAME}`">
                  <UInput
                    ref="presetNameInput"
                    v-model="presetName"
                    size="sm"
                    class="w-full"
                    placeholder="e.g. Instagram portrait"
                    :maxlength="MAX_PRESET_NAME"
                    aria-label="Preset name"
                  />
                </UFormField>
                <p v-if="presetRenamedTo" class="text-xs text-warning-600 dark:text-warning-400">
                  A preset with that name exists — this one will be saved as “{{ presetRenamedTo }}”.
                </p>
                <p v-else-if="presetsFull" class="text-xs text-warning-600 dark:text-warning-400">
                  You have {{ MAX_NAMED_ENTRIES }} saved presets — the oldest one is dropped to make room.
                </p>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">Kept for all your videos.</span>
                  <div class="flex gap-1.5">
                    <UButton size="sm" color="neutral" variant="ghost" @click="savingPreset = false">Cancel</UButton>
                    <UButton
                      size="sm"
                      type="submit"
                      icon="i-lucide-check"
                      color="neutral"
                      class="bg-amber-500 text-white hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-gray-950 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                      :disabled="!presetName.trim()"
                    >
                      Save
                    </UButton>
                  </div>
                </div>
              </form>
            </template>
          </UPopover>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            title="Save your presets to a file, to share or keep"
            :disabled="!exportPresets.saved.value.length"
            @click="onExportPresets"
          >
            Export
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-upload" title="Add presets from a file" @click="presetFileInput?.click()">
            Import
          </UButton>
          <input ref="presetFileInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-hidden="true" @change="onImportPresets" />
          <span v-if="!presetToSave && !activePreset" class="text-xs text-gray-500 dark:text-gray-400">
            To save your own, turn on crop and resize and pick a shape such as 16:9.
          </span>
        </div>
      </div>

      <USwitch v-model="cropOn" label="Also crop" description="Keep only part of the picture." @update:model-value="onCropToggle" />
      <template v-if="cropOn">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Drag on the video to draw the area to keep — drag inside it to move, drag the white handles to resize. Use the playback bar under the video (or the
          trim handles above) to check other frames.
        </p>
        <div class="flex flex-wrap items-center gap-1">
          <span class="text-xs text-gray-500 mr-1">Shape</span>
          <UButton
            v-for="a in ASPECTS"
            :key="a.label"
            size="xs"
            color="neutral"
            :variant="cropAspect === a.value ? 'soft' : 'ghost'"
            :class="cropAspect === a.value ? TAB_ACCENTS.trim.soft : ''"
            @click="setAspect(a.value)"
          >
            {{ a.label }}
          </UButton>
          <UButton
            v-if="cropAspect"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-scan-face"
            :loading="autoCentering"
            class="ml-auto"
            title="Centre the crop on wherever the video moves the most"
            @click="onAutoCenter"
          >
            Auto-center
          </UButton>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-maximize" :class="cropAspect ? '' : 'ml-auto'" @click="cropFull"
            >Whole frame</UButton
          >
        </div>
      </template>
      <EditorSection
        v-if="cropOn"
        v-model:open="cropFieldsOpen"
        title="Exact crop values"
        :hint="crop.w && crop.h ? `${crop.w}×${crop.h} at ${crop.x}, ${crop.y}` : 'not drawn yet'"
      >
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <UFormField label="X"><UInput v-model.number="crop.x" type="number" size="sm" /></UFormField>
          <UFormField label="Y"><UInput v-model.number="crop.y" type="number" size="sm" /></UFormField>
          <UFormField label="Width"><UInput v-model.number="crop.w" type="number" size="sm" /></UFormField>
          <UFormField label="Height"><UInput v-model.number="crop.h" type="number" size="sm" /></UFormField>
        </div>
      </EditorSection>

      <USwitch
        v-model="scaleOn"
        label="Also resize the output"
        description="Set the exact width and height of the result."
        @update:model-value="onScaleToggle"
      />
      <div v-if="scaleOn" class="space-y-2.5" data-testid="resize">
        <!-- The usual sizes, in the shape of the picture after the crop and turn -->
        <div v-if="resizeOptions.length" class="flex flex-wrap gap-1.5" role="group" aria-label="Common sizes">
          <UButton
            v-for="c in resizeOptions"
            :key="c.label"
            size="xs"
            :color="scale.w === c.w && scale.h === c.h ? 'primary' : 'neutral'"
            :variant="scale.w === c.w && scale.h === c.h ? 'soft' : 'outline'"
            :aria-pressed="scale.w === c.w && scale.h === c.h"
            @click="pickScale(c)"
          >
            {{ c.label }} <span class="tabular-nums opacity-70">{{ c.w }}×{{ c.h }}</span>
          </UButton>
        </div>
        <div class="flex items-end gap-2">
          <UFormField label="Width" class="flex-1">
            <UInput :model-value="scale.w" type="number" size="sm" min="2" class="w-full" @update:model-value="(v) => setScaleSide('w', Number(v))" />
          </UFormField>
          <UButton
            size="sm"
            color="neutral"
            :variant="scaleLock ? 'soft' : 'ghost'"
            :icon="scaleLock ? 'i-lucide-link' : 'i-lucide-unlink'"
            :aria-pressed="scaleLock"
            :aria-label="scaleLock ? 'Keep shape is on: the other side follows' : 'Keep shape is off: each side is set on its own'"
            :title="scaleLock ? 'Keep shape: on' : 'Keep shape: off'"
            @click="scaleLock = !scaleLock"
          />
          <UFormField label="Height" class="flex-1">
            <UInput :model-value="scale.h" type="number" size="sm" min="2" class="w-full" @update:model-value="(v) => setScaleSide('h', Number(v))" />
          </UFormField>
        </div>
        <p v-if="resizeFrom" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          From {{ resizeFrom.w }}×{{ resizeFrom.h }}<template v-if="resizeFromNote"> ({{ resizeFromNote }})</template>.
        </p>
        <p v-if="scaleNotes.stretched" class="flex flex-wrap items-center gap-x-2 text-xs text-warning-700 dark:text-warning-400" role="status">
          <span>A different shape from the picture — it will be stretched.</span>
          <UButton size="xs" color="neutral" variant="link" :padded="false" @click="matchScaleShape">Match the shape</UButton>
        </p>
        <p v-if="scaleNotes.larger" class="text-xs text-gray-600 dark:text-gray-300" role="status">
          Larger than the picture: it gets bigger, not sharper — no detail is added, and the file grows.
        </p>
      </div>

      <!-- Turn and flip: done after the crop, before the resize -->
      <div class="space-y-1.5" role="group" aria-label="Turn and flip">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-gray-500 dark:text-gray-400">Turn and flip</p>
          <UButton v-if="orientActive" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="orient = { ...NO_ORIENTATION }"
            >Reset</UButton
          >
        </div>
        <div class="flex flex-wrap items-center gap-1.5">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :class="TAB_ACCENTS.trim.soft"
            icon="i-lucide-rotate-ccw-square"
            @click="orient = turned(orient, -1)"
            >Left</UButton
          >
          <UButton size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.trim.soft" icon="i-lucide-rotate-cw-square" @click="orient = turned(orient, 1)"
            >Right</UButton
          >
          <UButton
            size="xs"
            color="neutral"
            :variant="orient.flipH ? 'soft' : 'ghost'"
            :class="orient.flipH ? TAB_ACCENTS.trim.soft : ''"
            :aria-pressed="orient.flipH"
            icon="i-lucide-flip-horizontal-2"
            @click="orient = { ...orient, flipH: !orient.flipH }"
          >
            Flip left–right
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            :variant="orient.flipV ? 'soft' : 'ghost'"
            :class="orient.flipV ? TAB_ACCENTS.trim.soft : ''"
            :aria-pressed="orient.flipV"
            icon="i-lucide-flip-vertical-2"
            @click="orient = { ...orient, flipV: !orient.flipV }"
          >
            Flip top–bottom
          </UButton>
          <!-- What the picture will look like: an F turned and flipped the same way -->
          <span
            class="ml-auto flex size-9 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-lg font-bold text-sky-700 dark:border-gray-800 dark:bg-gray-900 dark:text-sky-300"
            title="A sample letter turned and flipped the way your picture will be"
            aria-hidden="true"
          >
            <span class="inline-block transition-transform motion-reduce:transition-none" :style="{ transform: orientSampleTransform }">F</span>
          </span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{
            orientActive
              ? `${describeOrientation(orient)}. The crop is drawn on the picture as it is now.`
              : 'For a video filmed sideways or a mirrored webcam.'
          }}
        </p>
      </div>
    </section>

    <LookPanel v-model="look" />

    <TrimAudioPanel v-model="trimAudio" />

    <CutOutPanel
      v-model="cuts"
      :current-ms="currentMs"
      :duration-ms="durationMs"
      :can-write="canWrite"
      :busy="busy"
      :starting="cutStarting"
      @seek="(ms: number) => preview?.seek(ms, false)"
      @start="onStartCut"
    />

    <!-- Action: says what will be made before it is made -->
    <section class="sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-4" :class="TAB_ACCENTS.trim.divider" aria-label="Start trim">
      <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="trim-summary">{{ trimSummary }}</p>
      <p v-if="trimSizeHint" class="text-xs text-gray-500 dark:text-gray-400" data-testid="trim-size-hint">{{ trimSizeHint }}</p>
      <!-- Always takes its line, so the layout (and the video) don't jump while a crop is being drawn. -->
      <p class="text-xs min-h-4" :class="trimError ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'">
        {{ trimError ?? (trimDirty ? '' : 'Change the range, or turn on crop or resize, to make a trim.') }}
      </p>
      <UButton
        v-if="canWrite"
        block
        color="neutral"
        :class="TAB_ACCENTS.trim.button"
        icon="i-lucide-scissors"
        :loading="starting"
        :disabled="!!trimError || !trimDirty || busy"
        @click="onStartTrim"
      >
        Start trim
      </UButton>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The result appears under Results, where you can replace the original (kept under Versions) or add it as a new video.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
// The Trim tab of the video editor: range, crop, resize, turn and flip, the look, export presets, and the button that starts a trim.
import { NO_ORIENTATION, describeOrientation, turned } from '#shared/utils/videoEdit'
import { formatTimecode } from '#shared/utils/transport'
import { ratioLabel } from '#shared/utils/exportPreset'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { MAX_NAMED_ENTRIES } from '#shared/utils/namedList'
const {
  preview,
  currentMs,
  durationMs,
  range,
  extendOn,
  trimLimit,
  extension,
  cropOn,
  crop,
  onCropToggle,
  ASPECTS,
  cropAspect,
  setAspect,
  cropFull,
  presetTone,
  exportPresets,
  EXPORT_PRESETS,
  activePreset,
  multiExport,
  multiKeys,
  startingMulti,
  isPresetOn,
  onPresetClick,
  multiError,
  multiSummary,
  onStartMulti,
  savingPreset,
  presetName,
  MAX_PRESET_NAME,
  presetToSave,
  presetRenamedTo,
  presetsFull,
  openSavePreset,
  onSavePreset,
  onExportPresets,
  onImportPresets,
  renamingId,
  renameText,
  startRename,
  renameClash,
  onRenamePreset,
  removePreset,
  cropFieldsOpen,
  orient,
  orientActive,
  orientSampleTransform,
  resetTrim,
  TRIM_EDGES,
  setEdge,
  nudgeEdge,
  typeEdge,
  autoCentering,
  onAutoCenter,
  scaleOn,
  scale,
  resizeFrom,
  resizeOptions,
  scaleNotes,
  scaleLock,
  setScaleSide,
  pickScale,
  matchScaleShape,
  onScaleToggle,
  trimError,
  starting,
  onStartTrim,
  cuts,
  trimAudio,
  look,
  cutStarting,
  onStartCut,
  busy,
  trimDirty,
  trimSizeHint,
  trimSummary,
  formatMsShort,
  canWrite,
  presetNameInput,
  presetFileInput,
  renameInput
} = useClipEditorContext()

// What the resize starts from, when it isn't simply the whole video.
const resizeFromNote = computed(() => [cropOn.value && 'the crop', orientActive.value && 'turned'].filter(Boolean).join(', '))
</script>
