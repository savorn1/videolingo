<template>
  <UModal v-model:open="open" title="Share video" :description="video.title" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <div class="space-y-4">
        <UAlert v-if="warning" :color="warning.color" variant="subtle" :icon="warning.icon" :title="warning.title" :description="warning.description" />

        <UFormField label="Link" description="Opens this video in the learning area. People need to sign in to watch.">
          <div class="flex gap-2">
            <UInput :model-value="link" readonly class="flex-1 min-w-0" aria-label="Video link" @focus="($event.target as HTMLInputElement).select()" />
            <UButton :color="copied ? 'success' : 'primary'" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">
              {{ copied ? 'Copied' : 'Copy' }}
            </UButton>
          </div>
        </UFormField>

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <UCheckbox v-model="startAtCurrent" :disabled="currentMs <= 0" :label="startLabel" />
          <UButton v-if="canNativeShare" size="xs" color="neutral" variant="soft" icon="i-lucide-share-2" @click="nativeShare">More ways to share</UButton>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <UIcon :name="visibility.icon" class="w-3.5 h-3.5 shrink-0" />
          {{ visibility.label }} · {{ visibility.description }}
        </p>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex justify-end w-full">
        <UButton color="neutral" variant="ghost" @click="close">Done</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
// Builds a link to the video in the learning area — optionally starting at the
// moment the admin is watching — and copies it or hands it to the device's
// share sheet. The backend has no separate share token, so the link is the
// watch page's own URL; access still follows the video's visibility.
import type { Video } from '~/composables/useVideos'
import { VIDEO_VISIBILITIES } from '~/composables/useVideos'
import { formatTimecode } from '#shared/utils/transport'

const props = defineProps<{ video: Video; currentMs: number }>()
const open = defineModel<boolean>({ default: false })

const toast = useToast()
const copied = ref(false)
const startAtCurrent = ref(false)
const canNativeShare = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const origin = ref('')
onMounted(() => {
  origin.value = window.location.origin
  canNativeShare.value = typeof navigator.share === 'function'
})
onBeforeUnmount(() => clearTimeout(copiedTimer))

// Reopening starts from a clean state, at the current spot only if asked.
watch(open, (isOpen) => {
  if (!isOpen) return
  copied.value = false
  startAtCurrent.value = false
})

const link = computed(() => {
  const base = `${origin.value}/learn/watch/${props.video.id}`
  // The watch page reads ?t as milliseconds.
  return startAtCurrent.value && props.currentMs > 0 ? `${base}?t=${Math.round(props.currentMs)}` : base
})
const startLabel = computed(() => (props.currentMs > 0 ? `Start at ${formatTimecode(props.currentMs)}` : 'Start at the current time (play the video first)'))

const visibility = computed(() => VIDEO_VISIBILITIES.find((v) => v.value === props.video.visibility) ?? VIDEO_VISIBILITIES[0]!)

const warning = computed(() => {
  const v = props.video
  if (v.deleted) return { color: 'error' as const, icon: 'i-lucide-trash-2', title: 'This video is in the trash', description: 'The link will not work until you restore it.' }
  if (v.archived) return { color: 'warning' as const, icon: 'i-lucide-archive', title: 'This video is archived', description: 'Learners can’t open it until you unarchive it.' }
  if (!v.enabled) return { color: 'warning' as const, icon: 'i-lucide-eye-off', title: 'This video is disabled', description: 'Learners can’t open it until you enable it.' }
  if (v.visibility === 'PRIVATE') return { color: 'warning' as const, icon: 'i-lucide-lock', title: 'This video is private', description: 'Only its owner can open the link. Change the visibility to Unlisted or Public to share it.' }
  return null
})

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = false), 2000)
  } catch {
    toast.add({ title: 'Could not copy', description: 'Select the link and copy it by hand.', color: 'error' })
  }
}

async function nativeShare() {
  try {
    await navigator.share({ title: props.video.title, url: link.value })
  } catch {
    // Dismissing the share sheet rejects; nothing to report.
  }
}
</script>
