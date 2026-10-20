<template>
  <EditorSection
    v-model:open="open"
    title="Look"
    :changed="!isPlainLook(look) || !!lut"
    :hint="[describeVideoLook(look), lut ? 'colour grade' : ''].filter(Boolean).join(', ')"
    data-testid="look"
  >
    <div class="flex flex-wrap gap-1" role="group" aria-label="Looks">
      <UButton
        v-for="p in LOOK_PRESETS"
        :key="p.key"
        size="xs"
        color="neutral"
        :variant="matchingPreset(look)?.key === p.key ? 'soft' : 'outline'"
        :aria-pressed="matchingPreset(look)?.key === p.key"
        @click="look = { ...p.look }"
      >
        {{ p.label }}
      </UButton>
      <UButton v-if="!isPlainLook(look)" size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" @click="look = { ...PLAIN_LOOK }"
        >Reset look</UButton
      >
    </div>
    <SliderRow
      label="Brightness"
      :model-value="Math.round(look.brightness * 100)"
      :min="-100"
      :max="100"
      :step="5"
      :default-value="0"
      unit="%"
      @update:model-value="(v) => (look = { ...look, brightness: v / 100 })"
    />
    <SliderRow
      label="Contrast"
      :model-value="Math.round(look.contrast * 100)"
      :min="0"
      :max="200"
      :step="5"
      :default-value="100"
      unit="%"
      @update:model-value="(v) => (look = { ...look, contrast: v / 100 })"
    />
    <SliderRow
      label="Colour"
      :model-value="Math.round(look.saturation * 100)"
      :min="0"
      :max="300"
      :step="5"
      :default-value="100"
      unit="%"
      @update:model-value="(v) => (look = { ...look, saturation: v / 100 })"
    />
    <SliderRow
      label="Blur"
      :model-value="look.blur"
      :min="0"
      :max="MAX_LOOK_BLUR"
      :step="0.5"
      :default-value="0"
      @update:model-value="(v) => (look = { ...look, blur: v })"
    />
    <SliderRow
      label="Warmth"
      :model-value="Math.round((look.warmth ?? 0) * 100)"
      :min="-100"
      :max="100"
      :step="5"
      :default-value="0"
      unit="%"
      @update:model-value="(v) => (look = { ...look, warmth: v / 100 })"
    />
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <USwitch :model-value="!!look.sharpen" label="Sharpen" @update:model-value="(v: boolean) => (look = { ...look, sharpen: v })" />
      <USwitch
        :model-value="look.grayscale"
        label="Black & white"
        @update:model-value="(v: boolean) => (look = { ...look, grayscale: v, sepia: v ? false : look.sepia })"
      />
      <USwitch :model-value="look.sepia" label="Sepia" :disabled="look.grayscale" @update:model-value="(v: boolean) => (look = { ...look, sepia: v })" />
      <USwitch :model-value="look.vignette" label="Dark corners" @update:model-value="(v: boolean) => (look = { ...look, vignette: v })" />
    </div>
    <USwitch
      v-if="!isPlainLook(look)"
      v-model="compare"
      label="Compare before / after"
      description="A divider on the preview: as it is on the left, with the look on the right."
      data-testid="look-compare-switch"
    />
    <!-- A colour grade from an editing program or a LUT pack: a .cube file, applied after the look -->
    <div class="space-y-1" data-testid="colour-grade">
      <div class="flex flex-wrap items-center gap-2">
        <div class="min-w-40 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">Colour grade</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">A .cube file (a 3D LUT) from an editing app or a LUT pack, applied after the look.</p>
        </div>
        <template v-if="lut">
          <span class="max-w-40 truncate text-xs text-gray-700 dark:text-gray-300" data-testid="colour-grade-name">{{ lut.name }}</span>
          <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Remove the colour grade" @click="lut = null" />
        </template>
        <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-palette" :loading="lutProgress !== null" @click="lutInput?.click()">
          {{ lut ? 'Change' : 'Choose a .cube file' }}
        </UButton>
        <input ref="lutInput" type="file" accept=".cube" class="hidden" aria-label="Colour grade file" @change="onLutFile" />
      </div>
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">
      The preview is a close match; dark corners, sharpening and the colour grade show only in the rendered result (or a test render). Warmth below 0 cools
      toward blue.
    </p>
  </EditorSection>
</template>

<script setup lang="ts">
import { LOOK_PRESETS, MAX_LOOK_BLUR, PLAIN_LOOK, describeVideoLook, isPlainLook, matchingPreset, type VideoLook } from '#shared/utils/videoLook'
import { uploadToStorage } from '~/composables/useVideos'

const look = defineModel<VideoLook>({ required: true })
/** A colour grade: a .cube upload (kind LUT); null = none. */
const lut = defineModel<{ key: string; name: string } | null>('lut', { default: null })
/** The before/after divider on the preview (not part of the edit). */
const compare = defineModel<boolean>('compare', { default: false })

const open = ref(false)
// A look from a draft or an undo shows up open.
watch(
  () => isPlainLook(look.value) && !lut.value,
  (plain) => {
    if (!plain) open.value = true
  },
  { immediate: true }
)

/** The largest colour grade taken (backend VideoIngestService.MAX_LUT_BYTES). */
const MAX_LUT_BYTES = 16 * 1024 * 1024
const lutInput = ref<HTMLInputElement | null>(null)
const lutProgress = ref<number | null>(null)
const { requestUpload } = useVideos()
const toast = useToast()
async function onLutFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.name.toLowerCase().endsWith('.cube') || file.size > MAX_LUT_BYTES) {
    toast.add({ title: 'Not a colour grade', description: 'Choose a .cube file of up to 16 MB.', color: 'warning' })
    return
  }
  lutProgress.value = 0
  try {
    const ticket = await requestUpload('LUT', file)
    await uploadToStorage(ticket, file, (f) => (lutProgress.value = f))
    lut.value = { key: ticket.key, name: file.name }
  } catch (err) {
    toast.add({ title: 'Could not upload the colour grade', description: apiErrorMessage(err), color: 'error' })
  } finally {
    lutProgress.value = null
  }
}
</script>
