<template>
  <UPopover v-model:open="open">
    <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-badge-check" title="Your logo, card colours and progress bar, in one go"
      >Brand kit</UButton
    >
    <template #content>
      <div class="w-80 space-y-3 p-3" data-testid="brand-kit">
        <template v-if="kit">
          <div class="flex items-center gap-2">
            <img v-if="kit.logo" :src="kit.logo.dataUrl" alt="" class="size-10 rounded bg-gray-100 object-contain dark:bg-gray-800" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">Your brand kit</p>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ describeBrandKit(kit) }}</p>
            </div>
            <span class="size-5 rounded border border-gray-200 dark:border-gray-700" :style="{ background: kit.cardBackground }" />
            <span class="size-5 rounded border border-gray-200 dark:border-gray-700" :style="{ background: kit.cardColor }" />
          </div>
          <UButton block size="sm" icon="i-lucide-wand-sparkles" :loading="applying" @click="applyKit">Use on this video</UButton>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            The logo goes top right on the Text tab; the cards and progress bar are set on the Trim tab (under Blur, picture in picture & cards).
          </p>
        </template>
        <p v-else class="text-xs text-gray-500 dark:text-gray-400">
          No brand kit yet. Set the cards and progress bar on the Trim tab the way you like them, choose your logo, then save them here.
        </p>
        <form class="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800" @submit.prevent="saveKit">
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ kit ? 'Save again from this video' : 'Save from this video' }}</p>
          <div class="flex items-center gap-2">
            <img v-if="logo" :src="logo.dataUrl" alt="" class="size-8 rounded bg-gray-100 object-contain dark:bg-gray-800" />
            <span class="min-w-0 flex-1 truncate text-xs text-gray-600 dark:text-gray-300">{{ logo?.name ?? 'No logo' }}</span>
            <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-image-up" @click="logoInput?.click()">{{ logo ? 'Change' : 'Logo…' }}</UButton>
            <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" aria-label="Brand logo" @change="onLogo" />
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Keeps the logo, the cards' colours and words, and the progress bar colour, in this browser.</p>
          <div class="flex gap-2">
            <UButton type="submit" size="xs" icon="i-lucide-bookmark-plus">Save brand kit</UButton>
            <UButton v-if="kit" size="xs" color="neutral" variant="ghost" @click="forgetKit">Forget it</UButton>
          </div>
        </form>
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
// The brand kit (shared/utils/brandKit.ts): saved from this video's cards and progress bar plus a logo picture, and put
// on any video in one go — the logo is uploaded again each time (edit uploads don't last), as a watermark layer and the
// cards' logo.
import { BRAND_KIT_KEY, MAX_LOGO_DATA, brandKitFrom, cardsFromKit, describeBrandKit, sanitizeBrandKit, type BrandKit } from '#shared/utils/brandKit'
import { uploadToStorage } from '~/composables/useVideos'

const { extras, overlayEdit } = useClipEditorContext()
const { requestUpload } = useVideos()
const toast = useToast()
const open = ref(false)
const applying = ref(false)

function readKit(): BrandKit | null {
  try {
    return sanitizeBrandKit(JSON.parse(localStorage.getItem(BRAND_KIT_KEY) ?? 'null'))
  } catch {
    return null
  }
}
const kit = ref<BrandKit | null>(null)
const logo = ref<BrandKit['logo']>(null)
onMounted(() => {
  kit.value = readKit()
  logo.value = kit.value?.logo ?? null
})

const logoInput = ref<HTMLInputElement | null>(null)
function onLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result)
    if (dataUrl.length > MAX_LOGO_DATA) toast.add({ title: 'That logo is too big', description: 'Choose a picture under about 300 KB.', color: 'warning' })
    else logo.value = { dataUrl, name: file.name }
  }
  reader.readAsDataURL(file)
}

function saveKit() {
  const next = brandKitFrom(extras.value, logo.value)
  try {
    localStorage.setItem(BRAND_KIT_KEY, JSON.stringify(next))
    kit.value = next
    toast.add({ title: 'Brand kit saved', description: describeBrandKit(next), color: 'success' })
  } catch {
    toast.add({ title: 'Could not save the brand kit', description: 'The browser’s storage is full or blocked.', color: 'error' })
  }
}
function forgetKit() {
  try {
    localStorage.removeItem(BRAND_KIT_KEY)
  } catch {
    // Nothing kept to forget.
  }
  kit.value = null
}

async function applyKit() {
  const k = kit.value
  if (!k) return
  applying.value = true
  try {
    let uploaded: { key: string; name: string } | null = null
    if (k.logo) {
      const blob = await (await fetch(k.logo.dataUrl)).blob()
      const ticket = await requestUpload('OVERLAY', { name: k.logo.name, type: blob.type, size: blob.size })
      await uploadToStorage(ticket, blob)
      uploaded = { key: ticket.key, name: k.logo.name }
      overlayEdit.addImage({ key: ticket.key, url: ticket.publicUrl, name: k.logo.name }, true)
    }
    const cards = cardsFromKit(k, extras.value.cards, uploaded)
    if (cards.intro || cards.outro) extras.value.cards = cards
    if (k.progressBar) extras.value.progressBar = k.progressBar
    open.value = false
    toast.add({ title: 'Brand kit applied', description: describeBrandKit(k), color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not apply the brand kit', description: apiErrorMessage(err), color: 'error' })
  } finally {
    applying.value = false
  }
}
</script>
