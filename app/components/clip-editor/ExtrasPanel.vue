<template>
  <EditorSection
    v-model:open="open"
    title="Blur, picture in picture & cards"
    :changed="!isPlainExtras(extras)"
    :hint="describeExtras(extras) ?? ''"
    data-testid="trim-extras"
  >
    <!-- Blurred areas -->
    <div class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
          Blur areas <span class="font-normal text-gray-500">— faces, names, number plates</span>
        </p>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          icon="i-lucide-square-dashed"
          :disabled="extras.blurs.length >= MAX_BLURS || !naturalWidth"
          @click="extras.blurs = [...extras.blurs, newBlurBox(naturalWidth, naturalHeight)]"
          >Add a blur area</UButton
        >
      </div>
      <ul v-if="extras.blurs.length" class="space-y-1">
        <li
          v-for="(b, i) in extras.blurs"
          :key="i"
          class="flex flex-wrap items-center gap-1 text-xs tabular-nums text-gray-600 dark:text-gray-300"
          data-testid="blur-row"
        >
          <span class="w-4">{{ i + 1 }}</span>
          {{ b.w }}×{{ b.h }} at {{ b.x }}, {{ b.y }}
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :aria-label="`Remove blurred area ${i + 1}`"
            class="ml-auto"
            @click="extras.blurs = extras.blurs.filter((_, j) => j !== i)"
          />
        </li>
      </ul>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        While this section is open the areas show on the preview: drag one to move it, its corner to resize. They are blurred for the whole clip.
      </p>
    </div>

    <!-- Picture in picture -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!extras.pip"
        label="Picture in picture"
        description="Another video in a corner (muted), from the start of the clip until it ends."
        @update:model-value="(on) => (extras.pip = on ? { videoId: null, videoTitle: null, corner: 'BOTTOM_RIGHT', sizePct: 30 } : null)"
      />
      <div v-if="extras.pip" class="flex flex-wrap items-end gap-2 pl-11">
        <UFormField label="Video" class="min-w-56 flex-1">
          <USelectMenu
            :model-value="extras.pip.videoId ?? undefined"
            v-model:search-term="pipSearch"
            :items="pipItems"
            value-key="value"
            :loading="pipLoading"
            ignore-filter
            placeholder="Find a video…"
            size="sm"
            class="w-full"
            aria-label="Video in the corner"
            @update:model-value="pickPip"
          />
        </UFormField>
        <UFormField label="Corner">
          <USelect
            v-model="extras.pip.corner"
            :items="PIP_CORNERS.map((c) => ({ label: c.label, value: c.value }))"
            size="sm"
            class="w-32"
            aria-label="Corner"
          />
        </UFormField>
        <SliderRow
          class="min-w-48 flex-1"
          label="Size"
          :model-value="extras.pip.sizePct"
          :min="MIN_PIP_PCT"
          :max="MAX_PIP_PCT"
          :step="5"
          :default-value="30"
          unit="% wide"
          @update:model-value="(v) => extras.pip && (extras.pip.sizePct = v)"
        />
      </div>
    </div>

    <!-- Title cards -->
    <div class="space-y-2">
      <USwitch
        :model-value="!!extras.cards"
        label="Title cards"
        description="Text on a colour before and/or after the clip, fading in and out (silent)."
        @update:model-value="
          (on) =>
            (extras.cards = on
              ? {
                  intro: { text: video.title.slice(0, 120), durationMs: 3000 },
                  outro: null,
                  background: '#1e3a8a',
                  color: '#ffffff',
                  logoKey: null,
                  logoName: null
                }
              : null)
        "
      />
      <div v-if="extras.cards" class="space-y-2 pl-11">
        <div v-for="which in ['intro', 'outro'] as const" :key="which" class="space-y-1">
          <USwitch
            size="sm"
            :model-value="!!extras.cards[which]"
            :label="which === 'intro' ? 'Before the clip' : 'After the clip'"
            @update:model-value="
              (on) =>
                extras.cards &&
                (extras.cards[which] = on ? { text: which === 'intro' ? video.title.slice(0, 120) : 'Thanks for watching', durationMs: 3000 } : null)
            "
          />
          <div v-if="extras.cards[which]" class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="extras.cards[which]!.text"
              :maxlength="MAX_CARD_TEXT"
              size="sm"
              class="min-w-48 flex-1"
              :aria-label="`${which === 'intro' ? 'Intro' : 'Outro'} card text`"
            />
            <SliderRow
              class="w-56"
              label="For"
              :model-value="extras.cards[which]!.durationMs / 1000"
              :min="1"
              :max="6"
              :step="0.5"
              :default-value="3"
              unit=" s"
              @update:model-value="(v) => extras.cards?.[which] && (extras.cards[which]!.durationMs = Math.round(v * 1000))"
            />
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          <label class="flex items-center gap-1.5"
            >Background
            <input
              v-model="extras.cards.background"
              type="color"
              class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
              aria-label="Card background"
          /></label>
          <label class="flex items-center gap-1.5"
            >Text
            <input
              v-model="extras.cards.color"
              type="color"
              class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
              aria-label="Card text colour"
          /></label>
          <template v-if="extras.cards.logoKey">
            <span class="truncate">Logo: {{ extras.cards.logoName }}</span>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Remove the logo"
              @click="Object.assign(extras.cards, { logoKey: null, logoName: null })"
            />
          </template>
          <UploadButton v-else label="Add a logo" accept="image/png,image/jpeg,image/webp" :progress="logoProgress" @pick="onLogo" />
        </div>
      </div>
    </div>
  </EditorSection>
</template>

<script setup lang="ts">
// Blur areas, picture in picture and title cards on a trim (trimExtras.ts). The settings live in useClipEditor
// (extras, in undo and drafts); blurEditing shows the blur boxes on the preview while this section is open.
import { describeExtras, isPlainExtras, MAX_BLURS, MAX_CARD_TEXT, MAX_PIP_PCT, MIN_PIP_PCT, newBlurBox, PIP_CORNERS } from '#shared/utils/trimExtras'
import { uploadToStorage } from '~/composables/useVideos'

const { extras, video, naturalWidth, naturalHeight, blurEditing } = useClipEditorContext()
const { list, requestUpload } = useVideos()
const toast = useToast()
const open = ref(false)
watch(open, (v) => (blurEditing.value = v), { immediate: true })
onBeforeUnmount(() => (blurEditing.value = false))

// ── The video in the corner: any other stored video not in the trash ──
const pipSearch = ref('')
const pipLoading = ref(false)
const pipItems = ref<{ label: string; value: number }[]>([])
async function findPip() {
  pipLoading.value = true
  try {
    const found = (await list({ search: pipSearch.value || undefined, size: 20 })).data
    pipItems.value = found.filter((v) => v.storageKey && !v.deleted && v.id !== video.value.id).map((v) => ({ label: v.title, value: v.id }))
    const chosen = extras.value.pip
    if (chosen?.videoId && !pipItems.value.some((i) => i.value === chosen.videoId))
      pipItems.value.unshift({ label: chosen.videoTitle ?? `Video #${chosen.videoId}`, value: chosen.videoId })
  } catch {
    pipItems.value = []
  } finally {
    pipLoading.value = false
  }
}
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(pipSearch, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(findPip, 250)
})
watch(
  () => !!extras.value.pip,
  (on) => on && findPip(),
  { immediate: true }
)
function pickPip(id: unknown) {
  if (!extras.value.pip) return
  const item = pipItems.value.find((i) => i.value === Number(id))
  extras.value.pip.videoId = item ? item.value : null
  extras.value.pip.videoTitle = item?.label ?? null
}

// ── The cards' logo: an OVERLAY upload ──
const logoProgress = ref<number | null>(null)
async function onLogo(file: File) {
  logoProgress.value = 0
  try {
    const ticket = await requestUpload('OVERLAY', file)
    await uploadToStorage(ticket, file, (f) => (logoProgress.value = f))
    if (extras.value.cards) Object.assign(extras.value.cards, { logoKey: ticket.key, logoName: file.name })
  } catch (err) {
    toast.add({ title: 'Could not upload the logo', description: apiErrorMessage(err), color: 'error' })
  } finally {
    logoProgress.value = null
  }
}
</script>
