<template>
  <div class="space-y-4 text-sm">
    <!-- Groups fold away; a dot on a heading means it holds changes. -->

    <!-- ── Source ──────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.sound" title="Sound" :changed="changed.sound" :hint="s.source === 'ORIGINAL' ? 'The video’s own' : 'Replaced by a file'">
      <div class="flex flex-wrap gap-1">
        <UButton
          size="xs"
          :color="s.source === 'ORIGINAL' ? 'primary' : 'neutral'"
          :variant="s.source === 'ORIGINAL' ? 'soft' : 'ghost'"
          @click="s.source = 'ORIGINAL'"
        >
          The video's own
        </UButton>
        <UButton
          size="xs"
          :color="s.source === 'UPLOAD' ? 'primary' : 'neutral'"
          :variant="s.source === 'UPLOAD' ? 'soft' : 'ghost'"
          @click="s.source = 'UPLOAD'"
        >
          Replace with a file
        </UButton>
      </div>
      <template v-if="s.source === 'UPLOAD'">
        <div v-if="s.replacement" class="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1.5">
          <UIcon name="i-lucide-file-audio" class="w-4 h-4 shrink-0" :class="TAB_ACCENTS.audio.icon" />
          <span class="truncate flex-1" :title="s.replacement.name">{{ s.replacement.name }}</span>
          <span v-if="s.replacement.durationMs" class="text-xs text-gray-500 tabular-nums">{{ formatTimecode(s.replacement.durationMs) }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove replacement audio" @click="s.replacement = null" />
        </div>
        <UploadButton v-else label="Upload audio" :progress="uploading === 'replacement' ? uploadProgress : null" @pick="(f) => onUpload(f, 'replacement')" />
        <p class="text-xs text-gray-500 dark:text-gray-400">Plays from the start of the video; longer files are cut at its end, shorter ones leave silence.</p>
      </template>
    </EditorSection>

    <!-- ── Clips ───────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.clips" title="Clips" :changed="changed.clips" hint="on the strip under the video">
      <div class="flex flex-wrap gap-1">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-scissors-line-dashed" :disabled="!splittable" @click="onSplit"
          >Split at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" :disabled="!selected || s.clips.length >= MAX_AUDIO_CLIPS" @click="onDuplicate"
          >Duplicate</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-merge" :disabled="!hasNext" @click="onMerge">Merge with next</UButton>
        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="!selected" @click="onDeleteClip">Delete clip</UButton>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!edit.clipsChanged.value" @click="edit.resetClips()"
          >Reset clips</UButton
        >
      </div>
      <div v-if="selected" class="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="clip-fields">
        <UFormField label="Starts at (s)">
          <UInput :model-value="sec(selected.atMs)" type="number" step="0.01" min="0" size="sm" @update:model-value="(v) => patchClip({ atMs: ms(v) })" />
        </UFormField>
        <UFormField label="From (s)">
          <UInput
            :model-value="sec(selected.srcStartMs)"
            type="number"
            step="0.01"
            min="0"
            size="sm"
            @update:model-value="(v) => patchClip({ srcStartMs: ms(v) })"
          />
        </UFormField>
        <UFormField label="To (s)">
          <UInput
            :model-value="sec(selected.srcEndMs)"
            type="number"
            step="0.01"
            min="0"
            size="sm"
            @update:model-value="(v) => patchClip({ srcEndMs: ms(v) })"
          />
        </UFormField>
        <UFormField label="Volume %">
          <UInput
            :model-value="Math.round(selected.gain * 100)"
            type="number"
            step="5"
            min="0"
            :max="400"
            size="sm"
            @update:model-value="(v) => patchClip({ gain: Number(v) / 100 })"
          />
        </UFormField>
      </div>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">Select a clip on the strip to edit it.</p>
    </EditorSection>

    <!-- ── Range ───────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.range" title="Range" :changed="changed.range" :hint="`${formatTimecode(s.range[0])} – ${formatTimecode(s.range[1])}`">
      <USlider v-model="s.range" :min="0" :max="Math.max(durationMs, 1)" :step="10" :min-steps-between-thumbs="5" aria-label="Range" />
      <div class="flex flex-wrap gap-1">
        <UButton size="xs" color="neutral" variant="ghost" @click="s.range = [Math.min(Math.round(currentMs), s.range[1] - 50), s.range[1]]"
          >Start at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="ghost" @click="s.range = [s.range[0], Math.max(Math.round(currentMs), s.range[0] + 50)]"
          >End at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-volume-x" :disabled="!rangeValid" @click="onMuteRange">Mute range</UButton>
        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-eraser" :disabled="!rangeValid" @click="confirmDeleteRange = true"
          >Delete range</UButton
        >
      </div>
      <ul v-if="s.mutes.length" class="flex flex-wrap gap-1">
        <li v-for="(m, i) in s.mutes" :key="i">
          <UBadge color="error" variant="subtle" class="gap-1">
            <UIcon name="i-lucide-volume-x" class="w-3 h-3" />
            <span class="tabular-nums">{{ formatTimecode(m.startMs) }} – {{ formatTimecode(m.endMs) }}</span>
            <button type="button" class="ml-0.5 hover:text-error-700" :aria-label="`Unmute ${formatTimecode(m.startMs)}`" @click="s.mutes.splice(i, 1)">
              ✕
            </button>
          </UBadge>
        </li>
      </ul>
    </EditorSection>

    <!-- ── Level ───────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.level" title="Level" :changed="changed.level" :hint="`Volume ${Math.round(s.volume * 100)}%`">
      <SliderRow
        label="Volume"
        :model-value="Math.round(s.volume * 100)"
        :min="0"
        :max="400"
        :step="5"
        :default-value="100"
        unit="%"
        @update:model-value="(v) => (s.volume = v / 100)"
      />
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <USwitch :model-value="s.volume === 0" label="Mute everything" @update:model-value="(v) => (s.volume = v ? 0 : 1)" />
        <USwitch v-model="s.normalize" label="Normalize loudness" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <UFormField label="Fade in (s)">
          <UInput :model-value="sec(s.fadeInMs)" type="number" step="0.1" min="0" max="60" size="sm" @update:model-value="(v) => (s.fadeInMs = clampFade(v))" />
        </UFormField>
        <UFormField label="Fade out (s)">
          <UInput
            :model-value="sec(s.fadeOutMs)"
            type="number"
            step="0.1"
            min="0"
            max="60"
            size="sm"
            @update:model-value="(v) => (s.fadeOutMs = clampFade(v))"
          />
        </UFormField>
      </div>
      <!-- Volume curve: drawn on the "Volume" lane of the strip under the video -->
      <div class="space-y-1.5" data-testid="curve-tools">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          <span class="font-medium text-gray-700 dark:text-gray-300">Volume curve</span> —
          {{
            s.volumeCurve.length
              ? `${s.volumeCurve.length} point${s.volumeCurve.length === 1 ? '' : 's'}; drag them on the Volume lane under the video.`
              : 'click the Volume lane under the video to add points, or dip the sound under the range.'
          }}
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-arrow-down-to-line" :disabled="s.range[1] - s.range[0] < 200" @click="dipRange">
            Dip under the range to {{ Math.round(dipGain * 100) }}%
          </UButton>
          <USelect v-model="dipGain" :items="DIP_LEVELS" size="xs" class="w-20" aria-label="Dip level" />
          <UButton v-if="s.volumeCurve.length" size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="s.volumeCurve = []">Clear the curve</UButton>
        </div>
      </div>
    </EditorSection>

    <!-- ── Clean-up ────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.cleanup" title="Clean-up" :changed="changed.cleanup">
      <div class="flex flex-wrap items-center gap-1">
        <span class="w-28 text-xs text-gray-500">Noise reduction</span>
        <UButton
          v-for="d in DENOISE"
          :key="d.value"
          size="xs"
          :color="s.denoise === d.value ? 'primary' : 'neutral'"
          :variant="s.denoise === d.value ? 'soft' : 'ghost'"
          @click="s.denoise = d.value"
        >
          {{ d.label }}
        </UButton>
      </div>
      <USwitch v-model="s.enhanceVoice" label="Enhance voice" description="Cuts rumble and hiss, brings speech forward, evens out the level." />
      <USwitch v-model="s.deEss" label="Soften the “s” sounds" description="A de-esser: tames sharp, hissing s and sh sounds." />
      <div class="space-y-1" role="radiogroup" aria-label="Sound preset">
        <span class="text-xs text-gray-500">Sound like</span>
        <div class="flex flex-wrap gap-1">
          <UButton
            v-for="p in SOUND_PRESETS"
            :key="p.value"
            size="xs"
            role="radio"
            :aria-checked="s.preset === p.value"
            :title="p.hint || undefined"
            :color="s.preset === p.value ? 'primary' : 'neutral'"
            :variant="s.preset === p.value ? 'soft' : 'ghost'"
            @click="s.preset = p.value"
          >
            {{ p.label }}
          </UButton>
        </div>
      </div>
    </EditorSection>

    <!-- ── Music ───────────────────────────────────────────────────────── -->
    <EditorSection
      v-model:open="open.music"
      title="Background music & sound tracks"
      :changed="changed.music"
      :hint="s.tracks.length ? `+ ${s.tracks.length} track${s.tracks.length === 1 ? '' : 's'}` : undefined"
    >
      <template v-if="s.music">
        <div class="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1.5">
          <UIcon name="i-lucide-music" class="w-4 h-4 shrink-0" :class="TAB_ACCENTS.audio.icon" />
          <span class="truncate flex-1" :title="s.music.name">{{ s.music.name }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove background music" @click="s.music = null" />
        </div>
        <SliderRow
          label="Volume"
          :model-value="Math.round(s.music.volume * 100)"
          :min="0"
          :max="200"
          :step="5"
          :default-value="30"
          unit="%"
          @update:model-value="(v) => s.music && (s.music.volume = v / 100)"
        />
        <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
          <UFormField label="Starts at (s)" class="w-28">
            <UInput
              :model-value="sec(s.music.startMs)"
              type="number"
              step="0.1"
              min="0"
              size="sm"
              @update:model-value="(v) => s.music && (s.music.startMs = ms(v))"
            />
          </UFormField>
          <USwitch v-model="s.music.loop" label="Loop" />
          <USwitch v-model="s.music.duck" label="Quieter under speech" />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400" data-testid="music-preview-note">
          {{
            edit.localUrls.has(s.music.key)
              ? 'Plays along with the preview, at its volume up to 100 %; making it quieter under speech is heard in the result.'
              : 'Added on an earlier visit, so the preview can’t play it — it is in the result. Add it again to hear it here.'
          }}
        </p>
      </template>
      <UploadButton
        v-else
        label="Add music"
        icon="i-lucide-music"
        :progress="uploading === 'music' ? uploadProgress : null"
        @pick="(f) => onUpload(f, 'music')"
      />

      <!-- More sound beds besides the music: effects, a second bed — each mixed the same way -->
      <div class="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800" data-testid="sound-tracks">
        <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Sound tracks <span class="font-normal text-gray-500">(effects, a second bed)</span></p>
        <div v-for="(t, i) in s.tracks" :key="t.key + i" class="space-y-2 rounded-md border border-gray-200 p-2 dark:border-gray-800">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-audio-lines" class="w-4 h-4 shrink-0" :class="TAB_ACCENTS.audio.icon" />
            <span class="truncate flex-1 text-sm" :title="t.name">{{ t.name }}</span>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="`Remove sound track ${t.name}`" @click="s.tracks.splice(i, 1)" />
          </div>
          <SliderRow
            label="Volume"
            :model-value="Math.round(t.volume * 100)"
            :min="0"
            :max="200"
            :step="5"
            :default-value="100"
            unit="%"
            @update:model-value="(v) => (t.volume = v / 100)"
          />
          <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
            <UFormField label="Starts at (s)" class="w-28">
              <UInput
                :model-value="sec(t.startMs)"
                type="number"
                step="0.1"
                min="0"
                size="sm"
                :aria-label="`Sound track ${i + 1} starts at`"
                @update:model-value="(v) => (t.startMs = ms(v))"
              />
            </UFormField>
            <USwitch v-model="t.loop" label="Loop" />
            <USwitch v-model="t.duck" label="Quieter under speech" />
          </div>
        </div>
        <UploadButton
          v-if="s.tracks.length < MAX_SOUND_TRACKS"
          label="Add a sound track"
          icon="i-lucide-plus"
          :progress="uploading === 'track' ? uploadProgress : null"
          @pick="(f) => onUpload(f, 'track')"
        />
        <!-- Speak a line: text-to-speech, added as a sound track at the playhead -->
        <div
          v-if="s.tracks.length < MAX_SOUND_TRACKS"
          class="space-y-2 rounded-md border border-dashed border-gray-300 p-2 dark:border-gray-700"
          data-testid="narration"
        >
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Speak a line</p>
          <p v-if="narration.ready === false" class="text-xs text-gray-500 dark:text-gray-400">
            Text-to-speech isn't set up on the server (it needs an OpenAI API key).
          </p>
          <template v-else>
            <UTextarea
              v-model="narration.text"
              :rows="2"
              autoresize
              :maxrows="5"
              :maxlength="1000"
              placeholder="e.g. Listen, then repeat after me."
              class="w-full"
              aria-label="Line to speak"
            />
            <div class="flex flex-wrap items-center gap-2">
              <USelect v-model="narration.voice" :items="narration.voices" size="xs" class="w-36" aria-label="Voice" />
              <USelect
                v-model="narration.rate"
                :items="[
                  { label: 'Slower', value: 0.85 },
                  { label: 'Normal speed', value: 1 },
                  { label: 'Faster', value: 1.15 }
                ]"
                size="xs"
                class="w-32"
                aria-label="Speaking speed"
              />
              <UButton
                size="xs"
                icon="i-lucide-mic-vocal"
                :loading="narration.busy"
                :disabled="!narration.text.trim() || !narration.voice"
                class="ml-auto"
                @click="onNarrate"
                >Speak and add</UButton
              >
            </div>
          </template>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Up to {{ MAX_SOUND_TRACKS }}, each at its own volume and start — for example a sound effect at 0:12. They are heard in the result.
        </p>
      </div>
    </EditorSection>

    <!-- ── Speed & pitch ───────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.speed" title="Speed & pitch" :changed="changed.speed" :hint="`${+s.speed.toFixed(2)}×`">
      <SliderRow v-model="s.speed" label="Speed" :min="0.5" :max="2" :step="0.05" :default-value="1" unit="×" />
      <template v-if="s.speed !== 1">
        <USwitch
          v-model="s.keepSoundSpeed"
          label="Keep the sound at normal speed"
          :description="
            s.speed < 1
              ? 'Slow motion with the real sound: it plays at its own speed and the rest is silent.'
              : 'Fast motion with the real sound: it plays at its own speed and is cut at the new end.'
          "
          data-testid="keep-sound-speed"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400">
          {{ s.keepSoundSpeed ? 'Only the picture is re-timed' : 'The picture and the sound change speed together, so they stay in sync' }} — the video becomes
          {{ formatTimecode(durationMs / s.speed) }} long.
        </p>
      </template>
      <SliderRow v-model="s.pitchSemitones" label="Pitch" :min="-12" :max="12" :step="1" :default-value="0" unit="st" />
    </EditorSection>

    <!-- ── Channels ────────────────────────────────────────────────────── -->
    <EditorSection v-model:open="open.channels" title="Channels" :changed="changed.channels">
      <SliderRow
        label="Balance"
        :model-value="Math.round(s.balance * 100)"
        :min="-100"
        :max="100"
        :step="5"
        :default-value="0"
        @update:model-value="(v) => (s.balance = v / 100)"
      />
      <p class="text-xs text-gray-500 dark:text-gray-400 -mt-1">{{ balanceLabel }} — negative is left, positive is right.</p>
      <div class="flex flex-wrap items-center gap-1">
        <span class="w-16 text-xs text-gray-500">Output</span>
        <UButton
          v-for="c in CHANNELS"
          :key="c.value"
          size="xs"
          :color="s.channels === c.value ? 'primary' : 'neutral'"
          :variant="s.channels === c.value ? 'soft' : 'ghost'"
          @click="s.channels = c.value"
        >
          {{ c.label }}
        </UButton>
      </div>
    </EditorSection>

    <!-- ── Extract (a separate export, not part of the edit) ───────────── -->
    <EditorSection v-model:open="open.extract" title="Extract audio" hint="save the sound as a file">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-gray-500 dark:text-gray-400">Extract as</span>
        <UButton
          v-for="f in ['MP3', 'WAV'] as const"
          :key="f"
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-file-audio"
          :disabled="!canWrite || busy"
          :loading="extracting === f"
          @click="onExtract(f)"
        >
          {{ f }}
        </UButton>
      </div>
    </EditorSection>

    <!-- ── Render ──────────────────────────────────────────────────────── -->
    <section :class="ACTION_SECTION">
      <p class="text-sm text-gray-700 dark:text-gray-300" data-testid="audio-summary">{{ summary }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The preview plays the volume (up to 100%), muted ranges, fades and the background music; everything else is heard in the result.
      </p>
      <ul class="space-y-1 text-xs text-gray-600 dark:text-gray-300">
        <li class="flex items-start gap-1.5">
          <UIcon name="i-lucide-film" class="mt-0.5 size-3.5 shrink-0" :class="TAB_ACCENTS.audio.icon" />The result is your video with this sound, ready to
          watch.
        </li>
        <li class="flex items-start gap-1.5">
          <UIcon name="i-lucide-shield-check" class="mt-0.5 size-3.5 shrink-0" :class="TAB_ACCENTS.audio.icon" />
          Nothing changes until you choose: replace the original (kept under Versions) or add it as a new video.
        </li>
      </ul>
      <p class="text-xs min-h-4" :class="edit.error.value ? 'text-error-500' : 'text-gray-500 dark:text-gray-400'">
        {{ edit.error.value || (edit.changed.value ? '' : 'Change something above to make an audio edit.') }}
      </p>
      <div class="flex gap-2">
        <UButton
          v-if="canWrite"
          color="neutral"
          :class="['flex-1 justify-center', TAB_ACCENTS.audio.button]"
          icon="i-lucide-clapperboard"
          :loading="starting"
          :disabled="!!edit.error.value || !edit.changed.value || busy || !!uploading"
          @click="onRender"
        >
          Render video with this audio
        </UButton>
        <UTooltip text="Undoable — Ctrl/⌘+Z brings the settings back">
          <UButton class="ml-2" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!edit.changed.value" @click="edit.reset()">
            Reset
          </UButton>
        </UTooltip>
      </div>
    </section>

    <ConfirmModal
      v-model="confirmDeleteRange"
      title="Delete this range"
      :description="`Cut ${formatTimecode(s.range[0])} – ${formatTimecode(s.range[1])} out of the sound? The clips after it move up to close the gap. Ctrl/⌘+Z brings it back.`"
      confirm-label="Delete range"
      color="error"
      @confirm="onConfirmDeleteRange"
    />
  </div>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
// The Audio tab of the video editor: what to do with the sound. The clips
// themselves are shown (and dragged) on AudioStrip under the preview; both
// work on the same useAudioEdit state. Rendering and extracting run as EDIT
// jobs, whose results appear in the editor's Results list.
import type { AudioEdit, Channels, Denoise } from '~/composables/useAudioEdit'
import { uploadToStorage } from '~/composables/useVideos'
import {
  addMute,
  clipAt,
  clipEnd,
  deleteRange,
  dipPoints,
  duplicate,
  MAX_AUDIO_CLIPS,
  MAX_FADE_MS,
  MAX_SOUND_TRACKS,
  MIN_CLIP_MS,
  mergeWithNext,
  SOUND_PRESETS,
  splitAt,
  type AudioClip
} from '#shared/utils/audioEdit'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ edit: AudioEdit; videoId: number; durationMs: number; currentMs: number; canWrite: boolean; busy: boolean }>()
const emit = defineEmits<{ queued: [] }>()

const ACTION_SECTION = `sticky bottom-0 z-10 space-y-2 border-t bg-default pb-3 pt-3 ${TAB_ACCENTS.audio.divider}`
const DENOISE: { label: string; value: Denoise }[] = [
  { label: 'Off', value: 'OFF' },
  { label: 'Light', value: 'LIGHT' },
  { label: 'Strong', value: 'STRONG' }
]
const CHANNELS: { label: string; value: Channels }[] = [
  { label: 'Keep', value: 'KEEP' },
  { label: 'Mono', value: 'MONO' },
  { label: 'Stereo', value: 'STEREO' }
]

const toast = useToast()
const { startAudio, startExtract } = useVideoEdits()
const { requestUpload } = useVideos()
const s = props.edit.state

const sec = (ms: number) => +(ms / 1000).toFixed(2)
const ms = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 1000))
const clampFade = (v: unknown) => Math.min(ms(v), MAX_FADE_MS)

const balanceLabel = computed(() => (s.balance === 0 ? 'Centre' : `${s.balance < 0 ? 'L' : 'R'} ${Math.round(Math.abs(s.balance) * 100)}%`))

// ── Clips ────────────────────────────────────────────────────────────────────
const selected = computed(() => s.clips.find((c) => c.id === s.selectedId) ?? null)
const splitTarget = computed(() => {
  const under = clipAt(s.clips, props.currentMs)
  return selected.value && props.currentMs > selected.value.atMs && props.currentMs < clipEnd(selected.value) ? selected.value : under
})
const splittable = computed(() => {
  const c = splitTarget.value
  return !!c && props.currentMs - c.atMs >= MIN_CLIP_MS && clipEnd(c) - props.currentMs >= MIN_CLIP_MS
})
const hasNext = computed(() => {
  const c = selected.value
  return !!c && s.clips.some((x) => x.id !== c.id && x.atMs >= c.atMs)
})

function onSplit() {
  const c = splitTarget.value
  if (!c) return
  s.clips = splitAt(s.clips, c.id, props.currentMs)
  s.selectedId = c.id
}
function onDuplicate() {
  if (!selected.value) return
  const before = new Set(s.clips.map((c) => c.id))
  s.clips = duplicate(s.clips, selected.value.id, props.durationMs)
  s.selectedId = s.clips.find((c) => !before.has(c.id))?.id ?? s.selectedId
}
function onMerge() {
  if (selected.value) s.clips = mergeWithNext(s.clips, selected.value.id)
}
function onDeleteClip() {
  if (!selected.value) return
  s.clips = s.clips.filter((c) => c.id !== s.selectedId)
  s.selectedId = null
}
function patchClip(patch: Partial<AudioClip>) {
  const c = selected.value
  if (!c) return
  const next = { ...c, ...patch }
  next.srcStartMs = Math.min(Math.max(0, next.srcStartMs), props.edit.sourceMs.value - MIN_CLIP_MS)
  next.srcEndMs = Math.min(Math.max(next.srcStartMs + MIN_CLIP_MS, next.srcEndMs), props.edit.sourceMs.value)
  next.atMs = Math.min(Math.max(0, next.atMs), Math.max(0, props.durationMs - MIN_CLIP_MS))
  next.gain = Math.min(Math.max(0, next.gain || 0), 4)
  s.clips = s.clips.map((x) => (x.id === c.id ? next : x))
}

// ── Range ────────────────────────────────────────────────────────────────────
const rangeValid = computed(() => s.range[1] - s.range[0] >= MIN_CLIP_MS)
function onMuteRange() {
  s.mutes = addMute(s.mutes, { startMs: s.range[0], endMs: s.range[1] })
}
const confirmDeleteRange = ref(false)
function onConfirmDeleteRange() {
  confirmDeleteRange.value = false
  s.clips = deleteRange(s.clips, { startMs: s.range[0], endMs: s.range[1] })
  if (!s.clips.some((c) => c.id === s.selectedId)) s.selectedId = null
}

// ── Volume curve: dip under the range ──
const DIP_LEVELS = [0, 0.15, 0.3, 0.5, 0.7].map((g) => ({ label: `${Math.round(g * 100)}%`, value: g }))
const dipGain = ref(0.3)
function dipRange() {
  s.volumeCurve = dipPoints(s.volumeCurve, { startMs: s.range[0], endMs: s.range[1] }, dipGain.value, props.durationMs)
}

// ── Groups: open state, and which hold changes ───────────────────────────────
// What differs from the defaults (see useAudioEdit) — shown as a dot on the
// group heading, and used to open a group that has something in it.
const changed = computed(() => ({
  sound: s.source !== 'ORIGINAL',
  clips: props.edit.clipsChanged.value,
  range: s.mutes.length > 0,
  level: s.volume !== 1 || s.normalize || s.fadeInMs > 0 || s.fadeOutMs > 0 || s.volumeCurve.length > 0,
  cleanup: s.denoise !== 'OFF' || s.enhanceVoice || s.deEss || s.preset !== 'NONE',
  music: !!s.music || s.tracks.length > 0,
  speed: s.speed !== 1 || s.pitchSemitones !== 0,
  channels: s.balance !== 0 || s.channels !== 'KEEP'
}))
const open = reactive({
  sound: true,
  clips: true,
  range: true,
  level: changed.value.level,
  cleanup: changed.value.cleanup,
  music: changed.value.music,
  speed: changed.value.speed,
  channels: changed.value.channels,
  extract: false
})
// Undo, a restored draft or a new file can fill a folded group: show it.
for (const key of ['level', 'cleanup', 'music', 'speed', 'channels'] as const) {
  watch(
    () => changed.value[key],
    (isChanged) => isChanged && (open[key] = true)
  )
}

// One line on what rendering will do.
const summary = computed(() => {
  const parts: string[] = []
  if (s.source === 'UPLOAD') parts.push('replacement sound')
  if (props.edit.clipsChanged.value) parts.push('clips rearranged')
  if (s.mutes.length) parts.push(`${s.mutes.length} muted range${s.mutes.length === 1 ? '' : 's'}`)
  if (s.volume !== 1) parts.push(`volume ${Math.round(s.volume * 100)}%`)
  if (s.normalize) parts.push('normalized')
  if (s.fadeInMs > 0 || s.fadeOutMs > 0) parts.push('fades')
  if (s.denoise !== 'OFF') parts.push(`noise reduction ${s.denoise.toLowerCase()}`)
  if (s.enhanceVoice) parts.push('enhanced voice')
  if (s.deEss) parts.push('de-essed')
  if (s.preset !== 'NONE') parts.push(SOUND_PRESETS.find((p) => p.value === s.preset)!.label.toLowerCase())
  if (s.volumeCurve.length) parts.push('volume curve')
  if (s.music) parts.push('background music')
  if (s.tracks.length) parts.push(`${s.tracks.length} sound track${s.tracks.length === 1 ? '' : 's'}`)
  if (s.speed !== 1) parts.push(`speed ${+s.speed.toFixed(2)}×`)
  if (s.pitchSemitones !== 0) parts.push(`pitch ${s.pitchSemitones > 0 ? '+' : ''}${s.pitchSemitones} st`)
  if (s.balance !== 0) parts.push(`balance ${balanceLabel.value.toLowerCase()}`)
  if (s.channels !== 'KEEP') parts.push(s.channels.toLowerCase())
  return parts.length ? `Audio edit: ${parts.join(' · ')}` : 'No audio changes yet'
})

// ── Uploads ──────────────────────────────────────────────────────────────────
const uploading = ref<'replacement' | 'music' | 'track' | null>(null)
const uploadProgress = ref(0)

// ── Speak a line (text-to-speech), added as a sound track at the playhead ──
const { narrate } = useVideoEdits()
const { overview: dubOverview } = useDubs()
const narration = reactive({ text: '', voice: '', rate: 1, voices: [] as { label: string; value: string }[], ready: null as boolean | null, busy: false })
watch(
  () => open.music,
  async (isOpen) => {
    if (!isOpen || narration.ready !== null) return
    try {
      const o = await dubOverview(props.videoId)
      narration.ready = o.textToSpeechReady
      const list = Object.values(o.voices)[0] ?? []
      narration.voices = list.map((v) => ({ label: `${v.name} (${v.gender.toLowerCase()})`, value: v.id }))
      narration.voice ||= narration.voices[0]?.value ?? ''
    } catch {
      narration.ready = false
    }
  },
  { immediate: true }
)
async function onNarrate() {
  narration.busy = true
  try {
    const text = narration.text.trim()
    const spoken = await narrate(props.videoId, { text, voice: narration.voice, rate: narration.rate })
    s.tracks.push({
      key: spoken.key,
      name: `Spoken: “${text.length > 40 ? `${text.slice(0, 40)}…` : text}”`,
      durationMs: spoken.durationMs,
      volume: 1,
      loop: false,
      duck: false,
      startMs: Math.max(0, Math.round(props.currentMs))
    })
    narration.text = ''
    toast.add({ title: 'Line added as a sound track', description: 'Move it on the strip; it is heard in the result.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not speak the line', description: apiErrorMessage(err), color: 'error' })
  } finally {
    narration.busy = false
  }
}

async function onUpload(file: File, what: 'replacement' | 'music' | 'track') {
  uploading.value = what
  uploadProgress.value = 0
  try {
    const [durationMs, ticket] = await Promise.all([readAudioDuration(file), requestUpload('AUDIO', file)])
    await uploadToStorage(ticket, file, (f) => (uploadProgress.value = f))
    const uploaded = { key: ticket.key, name: file.name, durationMs }
    props.edit.rememberLocalFile(ticket.key, file)
    if (what === 'replacement') s.replacement = uploaded
    else if (what === 'track') s.tracks.push({ ...uploaded, volume: 1, loop: false, duck: false, startMs: Math.max(0, Math.round(props.currentMs)) })
    else s.music = { ...uploaded, volume: 0.3, loop: true, duck: true, startMs: 0 }
  } catch (err) {
    toast.add({ title: 'Could not upload the audio', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading.value = null
  }
}

// ── Jobs ─────────────────────────────────────────────────────────────────────
const starting = ref(false)
async function onRender() {
  if (props.edit.error.value) return
  starting.value = true
  try {
    const job = await startAudio(props.videoId, props.edit.request.value)
    toast.add({
      title: `Rendering your video with the new audio — job #${job.id}`,
      description: 'It will appear under Results when it is ready.',
      color: 'success'
    })
    emit('queued')
  } catch (err) {
    toast.add({ title: 'Could not start the audio edit', description: apiErrorMessage(err), color: 'error' })
  } finally {
    starting.value = false
  }
}

const extracting = ref<'MP3' | 'WAV' | null>(null)
async function onExtract(format: 'MP3' | 'WAV') {
  extracting.value = format
  try {
    const job = await startExtract(props.videoId, format)
    toast.add({ title: `Extracting the audio — job #${job.id}`, color: 'success' })
    emit('queued')
  } catch (err) {
    toast.add({ title: 'Could not extract the audio', description: apiErrorMessage(err), color: 'error' })
  } finally {
    extracting.value = null
  }
}
</script>
