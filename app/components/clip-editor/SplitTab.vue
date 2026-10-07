<template>
  <div class="space-y-4" :class="TAB_ACCENTS.split.scope">
    <!-- Strip: click a segment to select it and jump the video to its start -->
    <section class="space-y-2" aria-labelledby="split-strip-h">
      <div class="flex items-center justify-between gap-2">
        <h3 id="split-strip-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.split.heading">Segments</h3>
        <UButton
          v-if="splitDirty"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          title="Undoable — Ctrl/⌘+Z brings the segments back"
          @click="resetSplit"
        >
          Reset split
        </UButton>
      </div>
      <div v-if="durationMs" ref="segmentStrip" class="relative h-8 [@media(pointer:coarse)]:h-12 rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <button
          v-for="(bar, i) in segmentBars"
          :key="i"
          type="button"
          class="absolute inset-y-0 flex items-center justify-center text-[11px] font-medium text-white border-r border-white dark:border-gray-900 last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
          :class="[bar.valid ? bar.color : 'bg-error-500', selectedSegment === i ? 'ring-2 ring-inset ring-white' : 'opacity-80 hover:opacity-100']"
          :style="{ left: bar.leftPct + '%', width: bar.widthPct + '%' }"
          :aria-label="`Segment ${i + 1}`"
          @click="selectSegment(i)"
        >
          {{ i + 1 }}
        </button>
        <!-- Drag a shared boundary to move the cut (arrow keys nudge it) -->
        <template v-for="(_, i) in segments" :key="`cut-${i}`">
          <button
            v-if="boundaryAfter(segments, i) !== null"
            type="button"
            class="absolute inset-y-0 w-3 -ml-1.5 [@media(pointer:coarse)]:w-6 [@media(pointer:coarse)]:-ml-3 cursor-col-resize touch-none flex items-center justify-center focus-visible:outline-2 focus-visible:outline-white"
            :style="{ left: `${((boundaryAfter(segments, i)! * 1000) / durationMs) * 100}%` }"
            :aria-label="`Move the cut between segments ${i + 1} and ${i + 2}`"
            @pointerdown.prevent="(e: PointerEvent) => dragBoundary(i, e)"
            @keydown.left.prevent="nudgeBoundary(i, -1, $event.shiftKey)"
            @keydown.right.prevent="nudgeBoundary(i, 1, $event.shiftKey)"
          >
            <span class="h-4 w-1 rounded bg-white/90 shadow" />
          </button>
        </template>
        <!-- Playhead -->
        <span
          class="absolute inset-y-0 w-0.5 bg-black/70 dark:bg-white/80 pointer-events-none"
          :style="{ left: `${Math.min(100, (currentMs / durationMs) * 100)}%` }"
        />
      </div>
      <p v-if="uncoveredMs > 0 && !splitError" class="text-xs text-gray-500 dark:text-gray-400">
        {{ formatMsShort(uncoveredMs) }} of the video isn't in any segment and will be left out.
      </p>
    </section>

    <!-- Rows: typed times (1:23 or 1:23.5), length, remove -->
    <section class="space-y-1.5" aria-label="Segment times">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1.5 py-1 -mx-1.5"
        :class="[
          selectedSegment === i ? TAB_ACCENTS.split.selected : '',
          rowProblem(seg) ? 'ring-1 ring-inset ring-error-400 bg-error-50/60 dark:bg-error-950/30' : ''
        ]"
        :aria-current="selectedSegment === i ? 'true' : undefined"
        :aria-invalid="rowProblem(seg) ? 'true' : undefined"
        @focusin="selectedSegment = i"
      >
        <span class="w-5 text-xs text-gray-500 tabular-nums dark:text-gray-400">{{ i + 1 }}</span>
        <UInput
          :model-value="formatTimecode(seg.startMsSeconds * 1000)"
          size="sm"
          class="w-24"
          :ui="{ base: 'tabular-nums' }"
          :aria-label="`Segment ${i + 1} start`"
          @change="(e: Event) => typeSegment(i, 'start', e)"
        />
        <span class="text-xs text-gray-500 dark:text-gray-400">to</span>
        <UInput
          :model-value="seg.endMsSeconds == null ? '' : formatTimecode(seg.endMsSeconds * 1000)"
          size="sm"
          class="w-24"
          placeholder="end"
          :ui="{ base: 'tabular-nums' }"
          :aria-label="`Segment ${i + 1} end`"
          @change="(e: Event) => typeSegment(i, 'end', e)"
        />
        <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums ml-auto">{{ segmentLength(seg) }}</span>
        <p v-if="rowProblem(seg)" class="basis-full pl-7 text-xs text-error-600 dark:text-error-400" role="alert">{{ rowProblem(seg) }}</p>
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Remove segment"
          :disabled="segments.length <= 1"
          @click="removeSegment(i)"
        />
      </div>
    </section>

    <!-- Add -->
    <section class="space-y-2" aria-label="Add segments">
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          size="xs"
          color="neutral"
          :class="TAB_ACCENTS.split.button"
          icon="i-lucide-scissors-line-dashed"
          :disabled="!canSplitHere"
          @click="splitAtPlayhead"
          >Split at playhead</UButton
        >
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-plus"
          @click="segments.push({ startMsSeconds: 0, endMsSeconds: null })"
        >
          Add segment
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500">Split evenly:</span>
        <UButton
          v-for="n in [2, 3, 4, 5, 6, 8, 10]"
          :key="n"
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          :disabled="!durationMs || n > evenPartsMax"
          :title="durationMs && n > evenPartsMax ? tooManyPartsHint : undefined"
          @click="splitEvenly(n)"
        >
          {{ n }} parts
        </UButton>
        <form class="flex items-center gap-1" @submit.prevent="splitEvenly(customParts)">
          <UInput
            v-model.number="customParts"
            type="number"
            size="xs"
            :min="2"
            :max="evenPartsMax"
            class="w-16"
            aria-label="Number of equal parts"
            :disabled="!durationMs"
          />
          <UButton
            type="submit"
            size="xs"
            color="neutral"
            variant="soft"
            :class="TAB_ACCENTS.split.button"
            :disabled="!customPartsValid"
            :title="customPartsValid ? undefined : tooManyPartsHint"
          >
            Split
          </UButton>
        </form>
      </div>
      <p v-if="evenPreview" class="text-xs text-gray-500 dark:text-gray-400">{{ evenPreview }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500">Or every</span>
        <form class="flex items-center gap-1" @submit.prevent="splitEvery">
          <UInput
            v-model.number="everySeconds"
            type="number"
            size="xs"
            :min="MIN_TRIM_MS / 1000"
            class="w-20"
            aria-label="Seconds per part"
            :disabled="!durationMs"
          />
          <span class="text-xs text-gray-500">seconds</span>
          <UButton type="submit" size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.split.button" :disabled="!everyRows.length">Split</UButton>
        </form>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Play to a moment and press “Split at playhead” (or S) to cut the segment there in two. Drag a cut on the strip to move it; [ and ] jump between
        segments.
      </p>
    </section>

    <!-- Action -->
    <section class="sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-4" :class="TAB_ACCENTS.split.divider" aria-label="Start split">
      <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="split-summary">{{ splitSummary }}</p>
      <p v-if="splitSizeHint" class="text-xs text-gray-500 dark:text-gray-400">{{ splitSizeHint }}</p>
      <p class="text-xs min-h-4" :class="splitError ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'">
        {{ splitError ?? (splitDirty ? '' : 'Add a split point, or use “Split evenly”, to make more than one segment.') }}
      </p>
      <UButton
        v-if="canWrite"
        block
        color="neutral"
        :class="TAB_ACCENTS.split.button"
        icon="i-lucide-split"
        :loading="starting"
        :disabled="!!splitError || !splitDirty || busy"
        @click="onStartSplit"
      >
        Start split
      </UButton>
      <p class="text-xs text-gray-500 dark:text-gray-400">Each segment becomes a new video, disabled until you review and enable it.</p>
    </section>
  </div>
</template>

<script setup lang="ts">
// The Split tab of the video editor: the segment strip, the typed rows, the split helpers, and the button that starts a split.
import { boundaryAfter, MIN_TRIM_MS } from '#shared/utils/videoEdit'
import { formatTimecode } from '#shared/utils/transport'
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
const {
  currentMs,
  durationMs,
  starting,
  segments,
  segmentBars,
  resetSplit,
  selectedSegment,
  selectSegment,
  removeSegment,
  rowProblem,
  segmentLength,
  typeSegment,
  canSplitHere,
  splitAtPlayhead,
  uncoveredMs,
  splitSummary,
  dragBoundary,
  nudgeBoundary,
  everySeconds,
  everyRows,
  splitEvery,
  evenPreview,
  splitSizeHint,
  customParts,
  evenPartsMax,
  tooManyPartsHint,
  customPartsValid,
  splitEvenly,
  splitError,
  onStartSplit,
  busy,
  splitDirty,
  formatMsShort,
  canWrite,
  segmentStrip
} = useClipEditorContext()
</script>
