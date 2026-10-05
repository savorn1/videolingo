<template>
  <EditorSection v-model:open="open" title="Freeze frame" :changed="!!freeze" :hint="freeze ? (describeFreeze(freeze) ?? '') : ''" data-testid="freeze-frame">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Hold one picture for a few seconds mid-clip — to point something out — while the sound pauses. The rest of the clip plays on after it.
    </p>
    <div class="flex flex-wrap items-center gap-1.5">
      <UButton size="xs" color="neutral" variant="soft" :class="TAB_ACCENTS.trim.soft" icon="i-lucide-pause" :disabled="!canHoldHere" @click="holdHere">
        {{ freeze ? 'Move it to the playhead' : 'Hold the frame at the playhead' }}
      </UButton>
      <UButton v-if="freeze" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="freeze = null">Remove</UButton>
    </div>
    <template v-if="freeze">
      <p class="text-xs text-gray-700 dark:text-gray-300">
        At {{ formatTimecode(rangeStartMs + freeze.atMs) }} in the video ({{ formatTimecode(freeze.atMs) }} into the clip).
        <button type="button" class="text-sky-700 underline dark:text-sky-400" @click="emit('seek', rangeStartMs + freeze.atMs)">Show it</button>
      </p>
      <SliderRow
        label="Hold for"
        :model-value="freeze.durationMs / 1000"
        :min="MIN_FREEZE_MS / 1000"
        :max="MAX_FREEZE_MS / 1000"
        :step="0.5"
        :default-value="2"
        unit="s"
        @update:model-value="(v) => freeze && (freeze = { ...freeze, durationMs: Math.round(v * 1000) })"
      />
      <p class="text-xs" :class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'">
        {{ error ?? `The clip gets ${+(freeze.durationMs / 1000).toFixed(1)} s longer. Added audio is timed on the longer clip.` }}
      </p>
    </template>
    <p v-else-if="!canHoldHere" class="text-xs text-gray-500 dark:text-gray-400">Move the playhead inside the trim range first.</p>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Freeze frame" group: one held frame, placed at the playhead.
// The time is kept on the trimmed clip's own timeline (from its start), as the server wants it.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { formatTimecode } from '#shared/utils/transport'
import { MAX_FREEZE_MS, MIN_FREEZE_MS, describeFreeze, validateFreeze, type ClipFreeze } from '#shared/utils/videoEdit'

const props = defineProps<{ currentMs: number; rangeStartMs: number; rangeEndMs: number }>()
const emit = defineEmits<{ seek: [ms: number] }>()
const freeze = defineModel<ClipFreeze | null>({ required: true })

const clipMs = computed(() => Math.round(props.rangeEndMs - props.rangeStartMs))
const playheadInClip = computed(() => Math.round(props.currentMs - props.rangeStartMs))
const canHoldHere = computed(() => playheadInClip.value > 0 && playheadInClip.value < clipMs.value)
const error = computed(() => validateFreeze(freeze.value, clipMs.value))

function holdHere() {
  if (canHoldHere.value) freeze.value = { atMs: playheadInClip.value, durationMs: freeze.value?.durationMs ?? 2000 }
}

// Folded until used; a freeze from a draft or an undo shows up open.
const open = ref(false)
watch(
  () => !!freeze.value,
  (on) => on && (open.value = true),
  { immediate: true }
)
</script>
