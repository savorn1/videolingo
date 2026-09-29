<template>
  <div class="space-y-4 text-sm">
    <!-- ── Extract ─────────────────────────────────────────────────────── -->
    <section class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">Extract audio as</span>
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
    </section>

    <!-- ── Source ──────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Sound</h3>
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
          <UIcon name="i-lucide-file-audio" class="w-4 h-4 text-primary-500 shrink-0" />
          <span class="truncate flex-1" :title="s.replacement.name">{{ s.replacement.name }}</span>
          <span v-if="s.replacement.durationMs" class="text-xs text-gray-500 tabular-nums">{{ formatTimecode(s.replacement.durationMs) }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove replacement audio" @click="s.replacement = null" />
        </div>
        <UploadButton v-else label="Upload audio" :progress="uploading === 'replacement' ? uploadProgress : null" @pick="(f) => onUpload(f, 'replacement')" />
        <p class="text-xs text-gray-500 dark:text-gray-400">Plays from the start of the video; longer files are cut at its end, shorter ones leave silence.</p>
      </template>
    </section>

    <!-- ── Clips ───────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Clips <span class="normal-case font-normal">— on the strip under the video</span></h3>
      <div class="flex flex-wrap gap-1">
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-scissors-line-dashed" :disabled="!splittable" @click="onSplit"
          >Split at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-copy" :disabled="!selected || s.clips.length >= MAX_AUDIO_CLIPS" @click="onDuplicate"
          >Duplicate</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-merge" :disabled="!hasNext" @click="onMerge">Merge with next</UButton>
        <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :disabled="!selected" @click="onDeleteClip">Delete clip</UButton>
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
    </section>

    <!-- ── Range ───────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <div class="flex items-center justify-between">
        <h3 :class="HEADING">Range</h3>
        <span class="text-xs tabular-nums text-gray-700 dark:text-gray-300">{{ formatTimecode(s.range[0]) }} – {{ formatTimecode(s.range[1]) }}</span>
      </div>
      <USlider v-model="s.range" :min="0" :max="Math.max(durationMs, 1)" :step="10" :min-steps-between-thumbs="5" aria-label="Range" />
      <div class="flex flex-wrap gap-1">
        <UButton size="xs" color="neutral" variant="ghost" @click="s.range = [Math.min(Math.round(currentMs), s.range[1] - 50), s.range[1]]"
          >Start at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="ghost" @click="s.range = [s.range[0], Math.max(Math.round(currentMs), s.range[0] + 50)]"
          >End at playhead</UButton
        >
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-volume-x" :disabled="!rangeValid" @click="onMuteRange">Mute range</UButton>
        <UButton size="xs" color="error" variant="soft" icon="i-lucide-eraser" :disabled="!rangeValid" @click="onDeleteRange">Delete range</UButton>
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
    </section>

    <!-- ── Level ───────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Level</h3>
      <div class="flex items-center gap-3">
        <span class="w-16 text-xs text-gray-500">Volume</span>
        <USlider
          :model-value="Math.round(s.volume * 100)"
          :min="0"
          :max="400"
          :step="5"
          class="flex-1"
          aria-label="Volume"
          @update:model-value="(v) => (s.volume = Number(v) / 100)"
        />
        <span class="w-12 text-right text-xs tabular-nums">{{ Math.round(s.volume * 100) }}%</span>
      </div>
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
    </section>

    <!-- ── Clean-up ────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Clean-up</h3>
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
    </section>

    <!-- ── Music ───────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Background music</h3>
      <template v-if="s.music">
        <div class="flex items-center gap-2 rounded-md bg-gray-50 dark:bg-gray-800 px-2 py-1.5">
          <UIcon name="i-lucide-music" class="w-4 h-4 text-primary-500 shrink-0" />
          <span class="truncate flex-1" :title="s.music.name">{{ s.music.name }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove background music" @click="s.music = null" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-16 text-xs text-gray-500">Volume</span>
          <USlider
            :model-value="Math.round(s.music.volume * 100)"
            :min="0"
            :max="200"
            :step="5"
            class="flex-1"
            aria-label="Music volume"
            @update:model-value="(v) => s.music && (s.music.volume = Number(v) / 100)"
          />
          <span class="w-12 text-right text-xs tabular-nums">{{ Math.round(s.music.volume * 100) }}%</span>
        </div>
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
      </template>
      <UploadButton
        v-else
        label="Add music"
        icon="i-lucide-music"
        :progress="uploading === 'music' ? uploadProgress : null"
        @pick="(f) => onUpload(f, 'music')"
      />
    </section>

    <!-- ── Speed & pitch ───────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Speed &amp; pitch</h3>
      <div class="flex items-center gap-3">
        <span class="w-16 text-xs text-gray-500">Speed</span>
        <USlider v-model="s.speed" :min="0.5" :max="2" :step="0.05" class="flex-1" aria-label="Speed" />
        <span class="w-12 text-right text-xs tabular-nums">{{ +s.speed.toFixed(2) }}×</span>
      </div>
      <p v-if="s.speed !== 1" class="text-xs text-gray-500 dark:text-gray-400">
        The picture speeds up too, so they stay in sync — the video becomes {{ formatTimecode(durationMs / s.speed) }} long.
      </p>
      <div class="flex items-center gap-3">
        <span class="w-16 text-xs text-gray-500">Pitch</span>
        <USlider v-model="s.pitchSemitones" :min="-12" :max="12" :step="1" class="flex-1" aria-label="Pitch" />
        <span class="w-12 text-right text-xs tabular-nums">{{ s.pitchSemitones > 0 ? '+' : '' }}{{ s.pitchSemitones }} st</span>
      </div>
    </section>

    <!-- ── Channels ────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <h3 :class="HEADING">Channels</h3>
      <div class="flex items-center gap-3">
        <span class="w-16 text-xs text-gray-500">Balance</span>
        <USlider
          :model-value="Math.round(s.balance * 100)"
          :min="-100"
          :max="100"
          :step="5"
          class="flex-1"
          aria-label="Balance"
          @update:model-value="(v) => (s.balance = Number(v) / 100)"
        />
        <span class="w-12 text-right text-xs tabular-nums">{{ balanceLabel }}</span>
      </div>
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
    </section>

    <!-- ── Render ──────────────────────────────────────────────────────── -->
    <section :class="SECTION">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        The preview plays the volume (up to 100%) and muted ranges; everything else is heard in the result, which you can check before replacing the original.
      </p>
      <p class="text-xs text-error-500 min-h-4">{{ edit.error.value }}</p>
      <div class="flex gap-2">
        <UButton
          v-if="canWrite"
          class="flex-1 justify-center"
          icon="i-lucide-audio-lines"
          :loading="starting"
          :disabled="!!edit.error.value || busy || !!uploading"
          @click="onRender"
        >
          Render audio
        </UButton>
        <UTooltip text="Undoable — Ctrl/⌘+Z brings the settings back">
          <UButton class="ml-2" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" :disabled="!edit.changed.value" @click="edit.reset()">
            Reset
          </UButton>
        </UTooltip>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// The Audio tab of the video editor: what to do with the sound. The clips
// themselves are shown (and dragged) on AudioStrip under the preview; both
// work on the same useAudioEdit state. Rendering and extracting run as EDIT
// jobs, whose results appear in the editor's Results list.
import type { AudioEdit, Channels, Denoise } from '~/composables/useAudioEdit'
import { uploadToStorage } from '~/composables/useVideos'
import { addMute, clipAt, clipEnd, deleteRange, duplicate, MAX_AUDIO_CLIPS, MIN_CLIP_MS, mergeWithNext, splitAt, type AudioClip } from '#shared/utils/audioEdit'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ edit: AudioEdit; videoId: number; durationMs: number; currentMs: number; canWrite: boolean; busy: boolean }>()
const emit = defineEmits<{ queued: [] }>()

const SECTION = 'space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3'
const HEADING = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'
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
const clampFade = (v: unknown) => Math.min(ms(v), 60_000)

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
function onDeleteRange() {
  s.clips = deleteRange(s.clips, { startMs: s.range[0], endMs: s.range[1] })
  if (!s.clips.some((c) => c.id === s.selectedId)) s.selectedId = null
}

// ── Uploads ──────────────────────────────────────────────────────────────────
const uploading = ref<'replacement' | 'music' | null>(null)
const uploadProgress = ref(0)

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : null)
    a.onerror = () => done(null)
    a.src = url
  })
}

async function onUpload(file: File, what: 'replacement' | 'music') {
  uploading.value = what
  uploadProgress.value = 0
  try {
    const [durationMs, ticket] = await Promise.all([readDuration(file), requestUpload('AUDIO', file)])
    await uploadToStorage(ticket, file, (f) => (uploadProgress.value = f))
    const uploaded = { key: ticket.key, name: file.name, durationMs }
    if (what === 'replacement') s.replacement = uploaded
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
    toast.add({ title: `Audio edit queued — job #${job.id}`, color: 'success' })
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
