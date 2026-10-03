<template>
  <section class="space-y-3" aria-labelledby="trim-audio-h" data-testid="trim-audio">
    <h3 id="trim-audio-h" class="text-xs font-semibold uppercase tracking-wide" :class="TAB_ACCENTS.trim.heading">Add audio</h3>
    <template v-if="audio">
      <div class="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
        <UIcon name="i-lucide-music" class="h-4 w-4 shrink-0" :class="TAB_ACCENTS.trim.icon" />
        <span class="flex-1 truncate" :title="audio.name">{{ audio.name }}</span>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the added audio" @click="audio = null" />
      </div>
      <URadioGroup
        v-model="audio.mode"
        size="xs"
        orientation="horizontal"
        :items="[
          { label: 'Mix with the video sound', value: 'MIX' },
          { label: 'Replace the video sound', value: 'REPLACE' }
        ]"
      />
      <template v-if="audio.mode === 'MIX'">
        <SliderRow
          label="Volume"
          :model-value="Math.round(audio.volume * 100)"
          :min="0"
          :max="MAX_TRIM_AUDIO_VOLUME * 100"
          :step="5"
          :default-value="50"
          unit="%"
          @update:model-value="(v) => audio && (audio.volume = v / 100)"
        />
        <div class="flex flex-wrap items-end gap-x-4 gap-y-2">
          <UFormField label="Starts at (s)" class="w-28">
            <UInput
              :model-value="+(audio.startMs / 1000).toFixed(2)"
              type="number"
              step="0.1"
              min="0"
              size="sm"
              @update:model-value="(v) => audio && (audio.startMs = Math.max(0, Math.round((Number(v) || 0) * 1000)))"
            />
          </UFormField>
          <USwitch v-model="audio.loop" label="Loop" />
          <USwitch v-model="audio.duck" label="Quieter under speech" />
        </div>
      </template>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">The file plays from its start; the video's own sound is dropped.</p>
    </template>
    <UploadButton v-else label="Add audio file" icon="i-lucide-music" :progress="uploading ? progress : null" @pick="onPick" />
    <p class="text-xs text-gray-500 dark:text-gray-400">It is added to the trimmed result, so times here start at 0:00 of the trim.</p>
  </section>
</template>

<script setup lang="ts">
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { MAX_TRIM_AUDIO_VOLUME, newTrimAudio, type TrimAudioSettings } from '#shared/utils/trimAudio'
import { uploadToStorage } from '~/composables/useVideos'

const audio = defineModel<TrimAudioSettings | null>({ required: true })
const { requestUpload } = useVideos()
const toast = useToast()

const uploading = ref(false)
const progress = ref(0)

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

async function onPick(file: File) {
  uploading.value = true
  progress.value = 0
  try {
    const [durationMs, ticket] = await Promise.all([readDuration(file), requestUpload('AUDIO', file)])
    await uploadToStorage(ticket, file, (f) => (progress.value = f))
    audio.value = newTrimAudio({ key: ticket.key, name: file.name, durationMs })
  } catch (err) {
    toast.add({ title: 'Could not upload the audio', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
  }
}
</script>
