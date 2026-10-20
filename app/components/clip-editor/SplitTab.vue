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
        <!-- The video's markers, where "Split at markers" would cut -->
        <span
          v-for="m in markers"
          :key="`marker-${m.id}`"
          class="absolute top-0 h-2 w-0.5 -ml-px pointer-events-none"
          :class="m.chapter ? 'bg-amber-400' : 'bg-white/80 dark:bg-gray-300'"
          :style="{ left: `${Math.min(100, (m.atMs / durationMs) * 100)}%` }"
          aria-hidden="true"
        />
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
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="playingSegment === i ? 'i-lucide-square' : 'i-lucide-play'"
          :aria-label="playingSegment === i ? `Stop segment ${i + 1}` : `Play segment ${i + 1}`"
          :disabled="!!rowProblem(seg)"
          @click="playSegment(i)"
        />
        <p v-if="rowProblem(seg)" class="basis-full pl-7 text-xs text-error-600 dark:text-error-400" role="alert">{{ rowProblem(seg) }}</p>
        <p v-else-if="longRows.includes(i)" class="basis-full pl-7 text-xs text-warning-600 dark:text-warning-400">
          Longer than {{ formatMsShort(lengthLimitMs) }}
        </p>
        <div class="basis-full flex flex-wrap items-center gap-2 pl-7">
          <UInput
            :model-value="seg.label ?? ''"
            @update:model-value="(v: string) => (seg.label = v)"
            size="xs"
            class="min-w-0 flex-1"
            :maxlength="MAX_PART_LABEL"
            :placeholder="`Name (else “Part ${i + 1}”)`"
            :aria-label="`Segment ${i + 1} name`"
          />
          <USelect
            :model-value="seg.aspect ?? 0"
            size="xs"
            class="w-32"
            :items="PART_SHAPES.map((sh) => ({ label: sh.label, value: sh.value }))"
            :aria-label="`Segment ${i + 1} shape`"
            @update:model-value="(v: number) => (seg.aspect = v || null)"
          />
        </div>
        <p v-if="segmentSaying(seg)" class="basis-full pl-7 text-xs italic text-gray-500 dark:text-gray-400 truncate" :title="segmentSaying(seg)">
          “{{ segmentSaying(seg) }}”
        </p>
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
            step="any"
            class="w-20"
            aria-label="Seconds per part"
            :disabled="!durationMs"
          />
          <span class="text-xs text-gray-500">seconds</span>
          <UButton type="submit" size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.split.button" :disabled="!everyRows.length">Split</UButton>
        </form>
      </div>
      <form class="flex flex-wrap items-center gap-2" data-testid="split-near" @submit.prevent="splitNearLength">
        <span class="text-xs text-gray-500">Parts of about</span>
        <UInput
          v-model.number="nearSeconds"
          type="number"
          size="xs"
          :min="MIN_TRIM_MS / 1000"
          step="any"
          class="w-20"
          aria-label="Seconds per part, cut between sentences"
          :disabled="!durationMs"
        />
        <span class="text-xs text-gray-500">seconds, cut between sentences</span>
        <UButton type="submit" size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.split.button" :disabled="!nearSeconds || !durationMs"
          >Split</UButton
        >
      </form>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500">At pauses of</span>
        <USelect
          v-model="pauseSplitSeconds"
          size="xs"
          class="w-20"
          :items="PAUSE_SPLIT_SECONDS.map((n) => ({ label: `${n}s`, value: n }))"
          aria-label="Shortest pause to cut at"
        />
        <span class="text-xs text-gray-500">or longer</span>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.button"
          icon="i-lucide-audio-lines"
          :loading="pauseSplitting"
          :disabled="!durationMs"
          @click="splitAtPauses"
        >
          Split at pauses
        </UButton>
      </div>
      <div v-if="markers.length || aiChapters.length" class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="markers.length"
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-flag"
          :disabled="!markerSplit.rows.length"
          :title="markerSplit.tooMany ? `More than ${MAX_SEGMENTS} parts` : !markerSplit.rows.length ? 'No marker is far enough inside the video' : undefined"
          @click="splitAtMarkers"
        >
          Split at {{ chaptersOnly && hasChapterMarkers ? 'chapters' : 'markers' }}{{ markerSplit.rows.length ? ` (${markerSplit.rows.length} parts)` : '' }}
        </UButton>
        <UCheckbox v-if="hasChapterMarkers" v-model="chaptersOnly" size="xs" label="Chapters only" />
        <UButton
          v-if="aiChapters.length"
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-sparkles"
          :disabled="!aiChapterSplit.rows.length"
          :title="
            aiChapterSplit.tooMany
              ? `More than ${MAX_SEGMENTS} parts`
              : !aiChapterSplit.rows.length
                ? 'No AI chapter is far enough inside the video'
                : undefined
          "
          @click="splitAtAiChapters"
        >
          Split at AI chapters{{ aiChapterSplit.rows.length ? ` (${aiChapterSplit.rows.length} parts)` : '' }}
        </UButton>
      </div>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Play to a moment and press “Split at playhead” (or S) to cut the segment there in two. Drag a cut on the strip to move it; [ and ] jump between
        segments.
      </p>
    </section>

    <!-- Tidy the cuts made above -->
    <section class="space-y-2" aria-labelledby="split-tidy-h">
      <h3 id="split-tidy-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.split.heading">Tidy the cuts</h3>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-text-cursor"
          :loading="snappingCuts"
          :disabled="!hasSharedCuts"
          :title="hasSharedCuts ? `Moves each cut up to ${MAX_SNAP_MS / 1000}s, to a pause in the transcript` : 'Make a cut first'"
          @click="snapCutsToSentences"
        >
          Move cuts to sentence breaks
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-scissors"
          title="Each part starts and ends at its speech; the quiet cut off is left out"
          @click="tightenSegments"
        >
          Trim the quiet at the edges
        </UButton>
        <UButton
          v-if="canWrite"
          size="xs"
          color="neutral"
          variant="soft"
          :class="TAB_ACCENTS.split.soft"
          icon="i-lucide-bookmark-plus"
          :loading="savingMarkers"
          :disabled="!newCutMarkers.length"
          :title="newCutMarkers.length ? 'Keeps this split on the video’s timeline' : 'Every cut is marked already'"
          @click="saveCutsAsMarkers"
        >
          Save the cuts as markers{{ newCutMarkers.length ? ` (${newCutMarkers.length})` : '' }}
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500">Longest part</span>
        <USelect
          v-model="lengthLimitMs"
          size="xs"
          class="w-48"
          :items="[{ label: 'No limit', value: 0 }, ...SEGMENT_LENGTH_LIMITS.map((l) => ({ label: l.label, value: l.ms }))]"
          aria-label="Longest part allowed"
        />
        <template v-if="longRows.length">
          <span class="text-xs text-warning-600 dark:text-warning-400">{{ longRows.length }} too long</span>
          <UButton size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.split.button" @click="splitLongOnes">Split the long ones</UButton>
        </template>
      </div>
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
      <p class="text-xs text-gray-500 dark:text-gray-400">
        Each segment becomes a new video, disabled until you review and enable it, titled with its name (or “Part N”) and cropped to its shape.
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
// The Split tab of the video editor: the segment strip, the typed rows, the split helpers, and the button that starts a split.
import { boundaryAfter, MAX_PART_LABEL, MAX_SEGMENTS, MIN_TRIM_MS } from '#shared/utils/videoEdit'
import { MAX_SNAP_MS, PART_SHAPES, SEGMENT_LENGTH_LIMITS } from '#shared/utils/splitPoints'
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
  markers,
  chaptersOnly,
  hasChapterMarkers,
  markerSplit,
  splitAtMarkers,
  hasSharedCuts,
  snappingCuts,
  snapCutsToSentences,
  aiChapters,
  aiChapterSplit,
  splitAtAiChapters,
  nearSeconds,
  splitNearLength,
  PAUSE_SPLIT_SECONDS,
  pauseSplitSeconds,
  pauseSplitting,
  splitAtPauses,
  segmentSaying,
  playingSegment,
  playSegment,
  lengthLimitMs,
  longRows,
  splitLongOnes,
  tightenSegments,
  newCutMarkers,
  savingMarkers,
  saveCutsAsMarkers,
  splitError,
  onStartSplit,
  busy,
  splitDirty,
  formatMsShort,
  canWrite,
  segmentStrip
} = useClipEditorContext()
</script>
