<template>
  <div class="space-y-2" role="group" aria-label="Waveform templates">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs text-gray-500 dark:text-gray-400">Templates — one click sets the style and colours</p>
      <UPopover v-model:open="saving">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-bookmark-plus" :disabled="!current" @click="openSave">Save my look</UButton>
        <template #content>
          <form class="w-64 space-y-2 p-3" @submit.prevent="onSave">
            <UFormField label="Name for this look" :hint="`${name.length}/${MAX_NAME}`">
              <UInput v-model="name" size="sm" class="w-full" :maxlength="MAX_NAME" placeholder="e.g. Channel intro" aria-label="Template name" />
            </UFormField>
            <div class="flex justify-end gap-1.5">
              <UButton size="sm" color="neutral" variant="ghost" @click="saving = false">Cancel</UButton>
              <UButton size="sm" type="submit" icon="i-lucide-check" :disabled="!name.trim()">Save</UButton>
            </div>
          </form>
        </template>
      </UPopover>
    </div>

    <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <!-- No waveform: a still picture, the smallest file -->
      <li>
        <button
          type="button"
          class="block h-full w-full overflow-hidden rounded-lg border text-left transition focus-visible:outline-2 focus-visible:outline-primary-500"
          :class="
            !current ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600'
          "
          :aria-pressed="!current"
          title="A still picture makes the smallest file"
          @click="emit('clear')"
        >
          <span class="flex aspect-video items-center justify-center bg-gray-100 dark:bg-gray-800">
            <UIcon name="i-lucide-image" class="size-6 text-gray-400" />
          </span>
          <span class="flex items-center gap-1 px-2 py-1.5">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-gray-900 dark:text-white">No waveform</span>
              <span class="block truncate text-[11px] text-gray-500 dark:text-gray-400">Still picture, smallest file</span>
            </span>
            <UIcon v-if="!current" name="i-lucide-check" class="size-4 shrink-0 text-primary-600 dark:text-primary-400" />
          </span>
        </button>
      </li>
      <li v-for="t in templates.all.value" :key="t.id" class="group relative">
        <button
          type="button"
          class="block w-full overflow-hidden rounded-lg border text-left transition focus-visible:outline-2 focus-visible:outline-primary-500"
          :class="
            isCurrent(t.look)
              ? 'border-primary-500 ring-1 ring-primary-500'
              : 'border-gray-200 hover:border-gray-400 dark:border-gray-800 dark:hover:border-gray-600'
          "
          :aria-pressed="isCurrent(t.look)"
          :title="t.hint"
          @click="emit('apply', t.look)"
          @pointerenter="hovered = t.id"
          @pointerleave="hovered = null"
          @focus="hovered = t.id"
          @blur="hovered = null"
        >
          <span class="relative block aspect-video" :style="{ backgroundColor: t.look.background }">
            <WaveformPreview
              :kind="t.look.waveform"
              :color="t.look.waveColor"
              mini
              class="absolute"
              :class="
                waveformPlacement(t.look.waveform) === 'CENTER'
                  ? 'inset-x-[8%] top-[22%] h-[56%] w-[84%]'
                  : 'inset-x-1 bottom-[12%] h-1/3 w-[calc(100%-0.5rem)]'
              "
              :audio="audio"
              :still="hovered !== t.id"
            />
          </span>
          <span class="flex items-center gap-1 px-2 py-1.5">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium text-gray-900 dark:text-white">{{ t.name }}</span>
              <span class="block truncate text-[11px] text-gray-500 dark:text-gray-400">{{ t.hint }}</span>
            </span>
            <UIcon v-if="isCurrent(t.look)" name="i-lucide-check" class="size-4 shrink-0 text-primary-600 dark:text-primary-400" />
          </span>
        </button>
        <UButton
          v-if="!t.builtin"
          size="xs"
          color="neutral"
          variant="solid"
          icon="i-lucide-x"
          class="absolute right-1 top-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          :aria-label="`Delete template ${t.name}`"
          @click="templates.remove(t.id)"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// Ready-made waveform looks (style + line colour + background) plus the ones you save. The page
// owns the actual settings; this only shows the choices, marks the one that matches what is set
// now, and says which was picked (`apply`).
import { waveformPlacement } from '#shared/utils/audioVideo'
import type { WaveLook } from '#shared/utils/waveTemplates'
import type { AudioPeaks } from '~/composables/useAudioPeaks'

const props = defineProps<{
  /** What is set on the page now, or null when there is no moving waveform to save. */
  current: WaveLook | null
  /** The user's own sound, when it could be read: the card under the pointer then moves with it. */
  audio?: AudioPeaks | null
}>()
const emit = defineEmits<{ apply: [look: WaveLook]; clear: [] }>()

const toast = useToast()
const templates = useWaveTemplates()
const MAX_NAME = 30

const hovered = ref<string | null>(null)
const isCurrent = (look: WaveLook) =>
  !!props.current &&
  look.waveform === props.current.waveform &&
  look.waveColor.toLowerCase() === props.current.waveColor.toLowerCase() &&
  look.background.toLowerCase() === props.current.background.toLowerCase()

const saving = ref(false)
const name = ref('')
function openSave() {
  name.value = ''
}
function onSave() {
  const n = name.value.trim()
  if (!props.current || !n) return
  templates.save(n, props.current)
  toast.add({ title: `Saved “${n}”`, description: 'It is in the templates, ready for any video.', color: 'success' })
  saving.value = false
}
</script>
