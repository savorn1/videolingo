<template>
  <EditorSection v-model:open="open" title="Intro & outro cards" :changed="!!describeCards(cards)" :hint="describeCards(cards) ?? ''" data-testid="cards">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      A title card before the clip and/or one after it: your text on a colour, with your logo if you add one. Silent.
    </p>

    <div v-for="which in WHICH" :key="which.key" class="space-y-1.5">
      <USwitch :model-value="!!card(which.key)" :label="which.label" @update:model-value="(on: boolean) => toggle(which.key, on)" />
      <template v-if="card(which.key)">
        <UInput
          :model-value="card(which.key)!.text"
          :maxlength="MAX_CARD_TEXT"
          size="sm"
          class="w-full"
          :aria-label="`${which.label} text`"
          @update:model-value="(v) => setCard(which.key, { text: String(v) })"
        />
        <SliderRow
          label="Lasts"
          :model-value="card(which.key)!.durationMs / 1000"
          :min="MIN_CARD_MS / 1000"
          :max="MAX_CARD_MS / 1000"
          :step="0.5"
          :default-value="3"
          unit="s"
          @update:model-value="(v) => setCard(which.key, { durationMs: Math.round(v * 1000) })"
        />
      </template>
    </div>

    <template v-if="cards">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          Background
          <input
            type="color"
            :value="cards.background"
            class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            aria-label="Card background colour"
            @input="(e) => set({ background: (e.target as HTMLInputElement).value })"
          />
        </label>
        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          Text
          <input
            type="color"
            :value="cards.color"
            class="h-7 w-9 cursor-pointer rounded border border-gray-200 dark:border-gray-700"
            aria-label="Card text colour"
            @input="(e) => set({ color: (e.target as HTMLInputElement).value })"
          />
        </label>
        <UploadButton
          v-if="!cards.logoKey"
          label="Add a logo"
          accept="image/png,image/jpeg,image/webp"
          :progress="uploading ? progress : null"
          @pick="onLogo"
        />
        <UButton v-else size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="set({ logoKey: null, logoUrl: null })">Remove logo</UButton>
      </div>
      <!-- A small preview of the card -->
      <div
        class="flex aspect-video w-full max-w-xs flex-col items-center justify-center gap-2 rounded-md p-3 text-center"
        :style="{ background: cards.background }"
        data-testid="card-preview"
      >
        <img v-if="cards.logoUrl" :src="cards.logoUrl" alt="" class="max-h-[30%] max-w-[25%] object-contain" />
        <span class="text-sm font-bold leading-tight" :style="{ color: cards.color }">{{ (cards.intro ?? cards.outro)?.text || 'Your text' }}</span>
      </div>
      <p class="text-xs" :class="error ? 'text-error-600 dark:text-error-400' : 'text-gray-500 dark:text-gray-400'">
        {{ error ?? `Adds ${formatTimecode(cardsLength(cards))} to the clip.` }}
      </p>
    </template>
  </EditorSection>
</template>

<script setup lang="ts">
// The Trim tab's "Intro & outro cards" group. Starts with the video's title on the
// intro and "Thanks for watching" on the outro, white on the brand blue.
import { formatTimecode } from '#shared/utils/transport'
import { MAX_CARD_MS, MAX_CARD_TEXT, MIN_CARD_MS, cardsLength, describeCards, validateCards, type ClipCard, type ClipCards } from '#shared/utils/clipExtras'
import { uploadToStorage } from '~/composables/useVideos'

const props = defineProps<{ videoTitle: string }>()
const cards = defineModel<ClipCards | null>({ required: true })

const WHICH = [
  { key: 'intro' as const, label: 'Intro card', text: () => props.videoTitle.slice(0, MAX_CARD_TEXT) },
  { key: 'outro' as const, label: 'Outro card', text: () => 'Thanks for watching' }
]
const error = computed(() => validateCards(cards.value))

const card = (key: 'intro' | 'outro') => cards.value?.[key] ?? null
function set(patch: Partial<ClipCards>) {
  if (cards.value) cards.value = { ...cards.value, ...patch }
}
function setCard(key: 'intro' | 'outro', patch: Partial<ClipCard>) {
  const c = card(key)
  if (c) set({ [key]: { ...c, ...patch } })
}
function toggle(key: 'intro' | 'outro', on: boolean) {
  const base: ClipCards = cards.value ?? { intro: null, outro: null, background: '#1e3a8a', color: '#ffffff', logoKey: null, logoUrl: null }
  const next = { ...base, [key]: on ? { text: WHICH.find((w) => w.key === key)!.text(), durationMs: 3000 } : null }
  cards.value = next.intro || next.outro ? next : null
}

const { requestUpload } = useVideos()
const toast = useToast()
const uploading = ref(false)
const progress = ref(0)
async function onLogo(file: File) {
  uploading.value = true
  progress.value = 0
  try {
    const ticket = await requestUpload('OVERLAY', file)
    await uploadToStorage(ticket, file, (f) => (progress.value = f))
    set({ logoKey: ticket.key, logoUrl: ticket.publicUrl })
  } catch (err) {
    toast.add({ title: 'Could not upload the logo', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
  }
}

const open = ref(false)
watch(
  () => !!cards.value,
  (on) => on && (open.value = true),
  { immediate: true }
)
</script>
