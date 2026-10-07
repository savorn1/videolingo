<template>
  <UPopover v-model:open="open">
    <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-bookmark"
      >Saved looks{{ looks.saved.value.length ? ` (${looks.saved.value.length})` : '' }}</UButton
    >
    <template #content>
      <div class="w-80 space-y-3 p-3" data-testid="saved-looks">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          A whole look for a series — background, waveform, shape, size, strip and sound clean-up — kept in this browser. The logo isn't kept.
        </p>
        <ul
          v-if="looks.saved.value.length"
          class="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
        >
          <li v-for="l in looks.saved.value" :key="l.id" class="flex items-center gap-2 px-2.5 py-2">
            <span
              class="size-5 shrink-0 rounded-full ring-1 ring-gray-300 dark:ring-gray-600"
              :style="{ backgroundColor: l.data.background }"
              aria-hidden="true"
            />
            <button type="button" class="min-w-0 flex-1 text-left" :title="`Use “${l.name}”`" @click="apply(l.name, l.data)">
              <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">{{ l.name }}</span>
              <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ describeSeriesLook(l.data, waveLabel) }}</span>
            </button>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="`Delete the look ${l.name}`" @click="looks.remove(l.id)" />
          </li>
        </ul>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">No saved looks yet.</p>
        <form class="flex items-end gap-2" @submit.prevent="onSave">
          <UFormField label="Save the look set now as" class="min-w-0 flex-1">
            <UInput v-model="name" size="sm" class="w-full" :maxlength="40" placeholder="e.g. Weekly podcast" aria-label="Name for this look" />
          </UFormField>
          <UButton type="submit" size="sm" icon="i-lucide-check" :disabled="!name.trim()">Save</UButton>
        </form>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// Whole looks for a series on "Video from audio": save the look set now under a name, or put a saved one back.
import { WAVEFORM_STYLES } from '#shared/utils/audioVideo'
import { describeSeriesLook, type SeriesLook } from '#shared/utils/seriesLook'

const { currentSeriesLook, applySeriesLook } = useAudioToVideoFormContext()
const looks = useSeriesLooks()
const toast = useToast()
const open = ref(false)
const name = ref('')

const waveLabel = (style: string) => WAVEFORM_STYLES.find((w) => w.value === style)?.label ?? style

function onSave() {
  const n = name.value.trim()
  if (!n) return
  const used = looks.save(n, currentSeriesLook())
  name.value = ''
  toast.add({ title: `Saved “${used}”`, description: 'It is under Saved looks, ready for the next episode.', color: 'success' })
}
function apply(lookName: string, look: SeriesLook) {
  applySeriesLook(look)
  open.value = false
  toast.add({ title: `Using “${lookName}”`, color: 'info' })
}
</script>
