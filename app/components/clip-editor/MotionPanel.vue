<template>
  <EditorSection v-model:open="open" title="Motion & effects" :changed="!isPlainMotion(motion)" :hint="describeMotion(motion) ?? ''" data-testid="motion">
    <!-- Effect and fades -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <UFormField label="Effect">
        <USelect v-model="motion.effect" :items="TRIM_EFFECTS.map((e) => ({ label: e.label, value: e.value }))" size="sm" class="w-full" aria-label="Effect" />
      </UFormField>
      <div class="flex items-end gap-2">
        <UFormField label="Fade in (s)" class="w-24">
          <UInput
            :model-value="sec(motion.fadeInMs)"
            type="number"
            step="0.1"
            min="0"
            max="5"
            size="sm"
            @update:model-value="(v) => (motion.fadeInMs = ms(v))"
          />
        </UFormField>
        <UFormField label="Fade out (s)" class="w-24">
          <UInput
            :model-value="sec(motion.fadeOutMs)"
            type="number"
            step="0.1"
            min="0"
            max="5"
            size="sm"
            @update:model-value="(v) => (motion.fadeOutMs = ms(v))"
          />
        </UFormField>
        <USelect
          v-if="motion.fadeInMs || motion.fadeOutMs"
          v-model="motion.fadeColor"
          :items="[
            { label: 'Black', value: 'BLACK' },
            { label: 'White', value: 'WHITE' }
          ]"
          size="sm"
          class="w-24"
          aria-label="Fade colour"
        />
      </div>
    </div>

    <!-- Hold a frame -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!motion.freeze"
        label="Hold a frame"
        description="The picture stops for a moment (the sound pauses too), e.g. to point at something."
        @update:model-value="(on) => (motion.freeze = on ? { atMs: clipNow(), durationMs: 2000 } : null)"
      />
      <div v-if="motion.freeze" class="flex flex-wrap items-end gap-2 pl-11">
        <UFormField label="At (s, in the clip)" class="w-32">
          <UInput
            :model-value="sec(motion.freeze.atMs)"
            type="number"
            step="0.1"
            min="0"
            size="sm"
            @update:model-value="(v) => motion.freeze && (motion.freeze.atMs = ms(v))"
          />
        </UFormField>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-crosshair" @click="motion.freeze.atMs = clipNow()">At the playhead</UButton>
        <SliderRow
          class="min-w-48 flex-1"
          label="For"
          :model-value="motion.freeze.durationMs / 1000"
          :min="0.5"
          :max="10"
          :step="0.5"
          :default-value="2"
          unit=" s"
          @update:model-value="(v) => motion.freeze && (motion.freeze.durationMs = Math.round(v * 1000))"
        />
      </div>
    </div>

    <!-- Part at another speed -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!motion.speed"
        label="Slow motion or speed up a part"
        description="Only that part plays at another speed; the sound keeps its pitch."
        @update:model-value="(on) => (motion.speed = on ? defaultSpeedRange() : null)"
      />
      <div v-if="motion.speed" class="flex flex-wrap items-end gap-2 pl-11">
        <UFormField label="From (s)" class="w-24">
          <UInput
            :model-value="sec(motion.speed.startMs)"
            type="number"
            step="0.1"
            min="0"
            size="sm"
            @update:model-value="(v) => motion.speed && (motion.speed.startMs = ms(v))"
          />
        </UFormField>
        <UFormField label="To (s)" class="w-24">
          <UInput
            :model-value="sec(motion.speed.endMs)"
            type="number"
            step="0.1"
            min="0"
            size="sm"
            @update:model-value="(v) => motion.speed && (motion.speed.endMs = ms(v))"
          />
        </UFormField>
        <UFormField label="Speed">
          <USelect
            v-model="motion.speed.speed"
            :items="RAMP_SPEEDS.map((s) => ({ label: `${s}×`, value: s as number }))"
            size="sm"
            class="w-24"
            aria-label="Part speed"
          />
        </UFormField>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-crosshair" @click="motion.speed.startMs = clipNow()">From the playhead</UButton>
      </div>
    </div>

    <!-- Backwards, steadied -->
    <div class="flex flex-wrap gap-x-6 gap-y-2">
      <USwitch
        v-model="motion.reverse"
        label="Play backwards"
        :disabled="!motion.reverse && clipMs > MAX_REVERSE_MS"
        :description="clipMs > MAX_REVERSE_MS ? 'Only clips up to 60 s — trim it shorter.' : 'The picture and sound run in reverse.'"
      />
      <USwitch v-model="motion.stabilize" label="Steady a shaky picture" description="Takes longer to render." />
    </div>

    <!-- Zoom into an area -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!motion.zoomTo"
        label="Zoom into an area"
        description="From the whole picture into the chosen part, over the clip."
        @update:model-value="(on) => (motion.zoomTo = on ? { cx: 0.5, cy: 0.5, size: 0.5 } : null)"
      />
      <div v-if="motion.zoomTo" class="flex flex-wrap items-center gap-4 pl-11">
        <div class="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Where to zoom">
          <button
            v-for="p in ZOOM_SPOTS"
            :key="p.label"
            type="button"
            role="radio"
            class="size-7 rounded border text-[10px]"
            :class="
              motion.zoomTo.cx === p.cx && motion.zoomTo.cy === p.cy
                ? 'border-primary-500 bg-primary-500/20'
                : 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
            "
            :aria-checked="motion.zoomTo.cx === p.cx && motion.zoomTo.cy === p.cy"
            :aria-label="`Zoom to the ${p.label}`"
            :title="p.label"
            @click="Object.assign(motion.zoomTo, { cx: p.cx, cy: p.cy })"
          />
        </div>
        <SliderRow
          class="min-w-48 flex-1"
          label="Ends at"
          :model-value="Math.round(motion.zoomTo.size * 100)"
          :min="25"
          :max="95"
          :step="5"
          :default-value="50"
          unit="% of the picture"
          @update:model-value="(v) => motion.zoomTo && (motion.zoomTo.size = v / 100)"
        />
      </div>
    </div>

    <!-- Green screen -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!motion.greenScreen"
        label="Replace a green screen"
        description="A coloured backdrop (green by default) becomes a plain colour."
        @update:model-value="(on) => (motion.greenScreen = on ? { keyColor: '#00ff00', similarity: 0.3, background: '#1e3a8a' } : null)"
      />
      <div v-if="motion.greenScreen" class="flex flex-wrap items-center gap-3 pl-11">
        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          Backdrop
          <input
            v-model="motion.greenScreen.keyColor"
            type="color"
            class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            aria-label="Backdrop colour"
          />
        </label>
        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          New background
          <input
            v-model="motion.greenScreen.background"
            type="color"
            class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            aria-label="New background colour"
          />
        </label>
        <SliderRow
          class="min-w-48 flex-1"
          label="Tolerance"
          :model-value="Math.round(motion.greenScreen.similarity * 100)"
          :min="5"
          :max="60"
          :step="5"
          :default-value="30"
          @update:model-value="(v) => motion.greenScreen && (motion.greenScreen.similarity = v / 100)"
        />
      </div>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Times are in the trimmed clip (0 = where the trim starts). The preview doesn't show these — render to see them.
    </p>
  </EditorSection>
</template>

<script setup lang="ts">
// Motion & effects on a trim: effect, fades, a held frame, part at another speed, backwards, steadied, zoom into an
// area, green screen. The settings live in useClipEditor (motion, in undo and drafts); rules in videoMotion.ts.
import { describeMotion, isPlainMotion, MAX_REVERSE_MS, RAMP_SPEEDS, TRIM_EFFECTS } from '#shared/utils/videoMotion'

const { motion, currentMs, range } = useClipEditorContext()
const open = ref(false)

const ZOOM_SPOTS = [
  { label: 'top left', cx: 0.2, cy: 0.2 },
  { label: 'top', cx: 0.5, cy: 0.2 },
  { label: 'top right', cx: 0.8, cy: 0.2 },
  { label: 'left', cx: 0.2, cy: 0.5 },
  { label: 'centre', cx: 0.5, cy: 0.5 },
  { label: 'right', cx: 0.8, cy: 0.5 },
  { label: 'bottom left', cx: 0.2, cy: 0.8 },
  { label: 'bottom', cx: 0.5, cy: 0.8 },
  { label: 'bottom right', cx: 0.8, cy: 0.8 }
]

const clipMs = computed(() => Math.max(0, Math.round(range.value[1] - range.value[0])))
/** The playhead on the trimmed clip's timeline, kept inside it. */
function clipNow() {
  return Math.min(Math.max(100, Math.round(currentMs.value - range.value[0])), Math.max(100, clipMs.value - 100))
}
function defaultSpeedRange() {
  const start = clipNow()
  return { startMs: start, endMs: Math.min(clipMs.value, start + 2000), speed: 0.5 }
}
const sec = (v: number) => +(v / 1000).toFixed(2)
const ms = (v: unknown) => Math.max(0, Math.round(Number(v) * 1000) || 0)
</script>
