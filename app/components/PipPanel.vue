<template>
  <EditorSection v-model:open="open" title="Picture in picture" :changed="!!pip" :hint="pip?.title ?? ''" data-testid="pip">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Show another of your videos in a corner — a teacher's webcam, say. It starts with the clip, plays muted, and disappears if it ends first.
    </p>
    <UFormField label="Video">
      <USelectMenu
        :model-value="pip?.videoId ?? undefined"
        v-model:search-term="search"
        :items="items"
        value-key="value"
        :loading="loading"
        ignore-filter
        placeholder="Search your videos"
        class="w-full"
        aria-label="Video for the picture in picture"
        @update:open="(o: boolean) => o && find()"
        @update:model-value="pick"
      />
    </UFormField>
    <template v-if="pip">
      <div class="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Corner">
        <span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Corner</span>
        <UButton
          v-for="c in PIP_CORNERS"
          :key="c.value"
          size="xs"
          color="neutral"
          role="radio"
          :icon="c.icon"
          :aria-checked="pip.corner === c.value"
          :aria-label="c.label"
          :title="c.label"
          :variant="pip.corner === c.value ? 'soft' : 'ghost'"
          :class="pip.corner === c.value ? TAB_ACCENTS.trim.soft : ''"
          @click="pip = { ...pip, corner: c.value }"
        />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" class="ml-auto" @click="pip = null">Remove</UButton>
      </div>
      <SliderRow
        label="Size"
        :model-value="pip.sizePct"
        :min="MIN_PIP_PCT"
        :max="MAX_PIP_PCT"
        :step="5"
        :default-value="30"
        unit="%"
        @update:model-value="(v) => pip && (pip = { ...pip, sizePct: v })"
      />
      <p class="text-xs" :class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'">
        {{ error ?? 'Shown in the corner of the preview as its thumbnail.' }}
      </p>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Picture in picture" group: another stored video in a corner.
import { TAB_ACCENTS } from '#shared/utils/tabAccent'
import { blockedReason } from '#shared/utils/mergeVideos'
import { MAX_PIP_PCT, MIN_PIP_PCT, PIP_CORNERS, validatePip, type PipSettings } from '#shared/utils/clipExtras'
import type { Video } from '~/composables/useVideos'

const pip = defineModel<PipSettings | null>({ required: true })

const { list } = useVideos()
const search = ref('')
const loading = ref(false)
const found = ref<Video[]>([])
// Only stored files can be drawn in; links and trashed videos aren't offered.
const items = computed(() => found.value.filter((v) => !blockedReason(v)).map((v) => ({ label: v.title, value: v.id })))
const error = computed(() => validatePip(pip.value))

let timer: ReturnType<typeof setTimeout> | undefined
async function find() {
  loading.value = true
  try {
    found.value = (await list({ search: search.value.trim() || undefined, size: 20 })).data
  } catch {
    found.value = []
  } finally {
    loading.value = false
  }
}
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(find, 300)
})
onBeforeUnmount(() => clearTimeout(timer))

function pick(id: number | undefined) {
  const v = found.value.find((x) => x.id === id)
  if (!v) return
  pip.value = { videoId: v.id, title: v.title, thumbnailUrl: v.thumbnailUrl, corner: pip.value?.corner ?? 'BOTTOM_RIGHT', sizePct: pip.value?.sizePct ?? 30 }
}

const open = ref(false)
watch(
  () => !!pip.value,
  (on) => on && (open.value = true),
  { immediate: true }
)
</script>
