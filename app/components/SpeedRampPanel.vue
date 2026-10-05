<template>
  <EditorSection v-model:open="open" title="Slow motion / speed up" :changed="!!speed" :hint="describeSpeedRange(speed) ?? ''" data-testid="speed-ramp">
    <p class="text-xs text-gray-500 dark:text-gray-400">Play one part of the clip slower or faster; the voice keeps its pitch. Heard and seen in the result.</p>
    <div class="flex flex-wrap items-center gap-1.5">
      <UButton
        size="xs"
        color="neutral"
        variant="soft"
        :class="TAB_ACCENTS.trim.soft"
        icon="i-lucide-arrow-right-to-line"
        :disabled="!inClip"
        @click="setEdge('start')"
      >
        Starts here
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="soft"
        :class="TAB_ACCENTS.trim.soft"
        icon="i-lucide-arrow-left-to-line"
        :disabled="!inClip"
        @click="setEdge('end')"
      >
        Ends here
      </UButton>
      <UButton v-if="speed" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="speed = null">Remove</UButton>
    </div>
    <template v-if="speed">
      <p class="text-xs text-gray-700 dark:text-gray-300 tabular-nums">
        {{ formatTimecode(rangeStartMs + speed.startMs) }} – {{ formatTimecode(rangeStartMs + speed.endMs) }} in the video
      </p>
      <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Speed of the part">
        <UButton
          v-for="s in RAMP_SPEEDS"
          :key="s"
          size="xs"
          color="neutral"
          role="radio"
          :aria-checked="speed.speed === s"
          :variant="speed.speed === s ? 'soft' : 'ghost'"
          :class="speed.speed === s ? TAB_ACCENTS.trim.soft : ''"
          @click="speed = { ...speed, speed: s }"
        >
          {{ s }}×
        </UButton>
      </div>
      <p class="text-xs" :class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'">
        {{ error ?? `The clip becomes ${formatTimecode(rampedLength(clipMs, speed))} long.` }}
      </p>
    </template>
    <p v-else-if="!inClip" class="text-xs text-gray-500 dark:text-gray-400">Move the playhead inside the trim range first.</p>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Slow motion / speed up" group: one part of the clip at another
// speed. Times are kept on the trimmed clip's own timeline, as the server wants them.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { formatTimecode } from '#shared/utils/transport'
import { MIN_RAMP_MS, RAMP_SPEEDS, describeSpeedRange, rampedLength, validateSpeedRange, type SpeedRange } from '#shared/utils/clipExtras'

const props = defineProps<{ currentMs: number; rangeStartMs: number; rangeEndMs: number }>()
const speed = defineModel<SpeedRange | null>({ required: true })

const clipMs = computed(() => Math.round(props.rangeEndMs - props.rangeStartMs))
const here = computed(() => Math.round(props.currentMs - props.rangeStartMs))
const inClip = computed(() => here.value >= 0 && here.value <= clipMs.value)
const error = computed(() => validateSpeedRange(speed.value, clipMs.value))

// The first edge set makes a part from there (half a second at least, slowed to 0.5×); the other edge then moves.
function setEdge(edge: 'start' | 'end') {
  const at = Math.min(clipMs.value, Math.max(0, here.value))
  const cur = speed.value ?? {
    startMs: edge === 'start' ? at : Math.max(0, at - 2000),
    endMs: edge === 'end' ? at : Math.min(clipMs.value, at + 2000),
    speed: 0.5
  }
  const next =
    edge === 'start'
      ? { ...cur, startMs: at, endMs: Math.max(cur.endMs, at + MIN_RAMP_MS) }
      : { ...cur, endMs: at, startMs: Math.min(cur.startMs, at - MIN_RAMP_MS) }
  speed.value = { ...next, startMs: Math.max(0, next.startMs), endMs: Math.min(clipMs.value, next.endMs) }
}

const open = ref(false)
watch(
  () => !!speed.value,
  (on) => on && (open.value = true),
  { immediate: true }
)
</script>
