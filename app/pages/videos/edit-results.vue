<template>
  <div>
    <PageHeader
      title="Edit results"
      description="What finished edits made, across every video — waiting to replace an original, become new videos, or be discarded before they expire."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Edit results' }]"
    />

    <UCard :ui="{ body: 'space-y-3' }">
      <div class="flex flex-wrap items-center gap-2">
        <UCheckbox
          v-if="canWrite && promotable.length"
          :model-value="allPicked"
          :indeterminate="picked.length > 0 && !allPicked"
          label="Select all"
          @update:model-value="(v: boolean | 'indeterminate') => (picked = v === true ? promotable.map((r) => r.clip.id) : [])"
        />
        <template v-if="picked.length">
          <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">{{ picked.length }} selected</span>
          <UButton size="xs" icon="i-lucide-copy-plus" :loading="bulk === 'new'" :disabled="!!bulk" @click="bulkAddAsNew">Add as new videos</UButton>
          <UButton
            size="xs"
            color="error"
            variant="soft"
            icon="i-lucide-trash-2"
            :loading="bulk === 'discard'"
            :disabled="!!bulk"
            @click="confirmDiscard = true"
            >Discard</UButton
          >
        </template>
        <UButton class="ml-auto" size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="loading" @click="load">Refresh</UButton>
      </div>

      <p v-if="error" class="text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>
      <USkeleton v-else-if="rows === null" class="h-24 w-full" />
      <EmptyState
        v-else-if="!rows.length"
        icon="i-lucide-list-checks"
        title="No results waiting"
        description="Results of trims, splits, sound and text edits show up here until they are kept or discarded."
        class="py-6"
      />
      <ul v-else class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800" data-testid="edit-results">
        <li v-for="r in rows" :key="r.clip.id" class="flex flex-wrap items-center gap-3 px-3 py-2">
          <UCheckbox
            v-if="canWrite && promotable.includes(r)"
            :model-value="picked.includes(r.clip.id)"
            :aria-label="`Select ${clipLabel(r.clip)} of ${r.videoTitle ?? 'the video'}`"
            @update:model-value="(v: boolean | 'indeterminate') => toggle(r.clip.id, v === true)"
          />
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
          >
            <UIcon :name="CLIP_OPERATION_ICONS[r.clip.operation]" class="size-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ clipLabel(r.clip) }}
              <span class="font-normal text-gray-500 dark:text-gray-400">of</span>
              <NuxtLink :to="`/videos/${r.videoId}/editor`" class="text-primary-700 hover:underline dark:text-primary-400">{{
                r.videoTitle ?? `video #${r.videoId}`
              }}</NuxtLink>
              <UBadge v-if="r.videoDeleted" color="neutral" variant="subtle" size="sm" class="ml-1">in the trash</UBadge>
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              <template v-if="r.clip.summary">{{ r.clip.summary }} · </template>{{ formatFileSize(r.clip.sizeBytes) }} · made
              {{ formatRelativeTime(r.clip.createdAt) }} · expires {{ formatTimeUntil(r.clip.expiresAt) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <UButton v-if="r.clip.operation === 'EXTRACT'" size="xs" color="neutral" variant="soft" icon="i-lucide-download" :href="r.clip.url" download
              >Download</UButton
            >
            <UButton v-else size="xs" color="neutral" variant="soft" icon="i-lucide-play" @click="previewRow = r">Preview</UButton>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-square-pen" :to="`/videos/${r.videoId}/editor`">Open editor</UButton>
            <UButton
              v-if="canWrite"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Discard ${clipLabel(r.clip)}`"
              @click="discardOne(r)"
            />
          </div>
        </li>
      </ul>
      <p v-if="rows?.length" class="text-xs text-gray-500 dark:text-gray-400">
        To replace an original with a result (its old file kept under Versions), open the editor — it shows the result next to the video.
      </p>
    </UCard>

    <UModal
      :open="!!previewRow"
      :title="previewRow ? `${clipLabel(previewRow.clip)} of ${previewRow.videoTitle ?? ''}` : ''"
      @update:open="(v) => !v && (previewRow = null)"
    >
      <template #body>
        <video v-if="previewRow" :src="previewRow.clip.url" controls autoplay playsinline class="aspect-video w-full rounded-md bg-black" />
      </template>
    </UModal>

    <ConfirmModal
      v-model="confirmDiscard"
      title="Discard results"
      :description="`Discard ${picked.length} result${picked.length === 1 ? '' : 's'}? Their files are deleted; the videos stay as they are.`"
      confirm-label="Discard"
      color="error"
      :loading="bulk === 'discard'"
      @confirm="bulkDiscard"
    />
  </div>
</template>

<script setup lang="ts">
// Every edit result still kept, across all videos (VideoEditService.allResults), so they can be reviewed in one
// place: preview, add as new videos (several at once), discard, or open the video's editor to replace the original.
import type { EditResultRow } from '~/composables/useVideoEdits'
import { CLIP_OPERATION_ICONS, clipLabel, promotableAsNew } from '#shared/utils/editResults'
import { suggestedNewTitle } from '#shared/utils/videoEdit'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Edit results' })

const { allResults, promote, remove } = useVideoEdits()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('videos', 'WRITE'))

const rows = ref<EditResultRow[] | null>(null)
const loading = ref(false)
const error = ref('')
const picked = ref<number[]>([])
const bulk = ref<'new' | 'discard' | null>(null)
const confirmDiscard = ref(false)
const previewRow = ref<EditResultRow | null>(null)

const promotable = computed(() => promotableAsNew(rows.value ?? []))
const allPicked = computed(() => promotable.value.length > 0 && picked.value.length === promotable.value.length)
const pickedRows = computed(() => (rows.value ?? []).filter((r) => picked.value.includes(r.clip.id)))

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await allResults()
    picked.value = picked.value.filter((id) => rows.value!.some((r) => r.clip.id === id))
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

function toggle(id: number, on: boolean) {
  picked.value = on ? [...picked.value, id] : picked.value.filter((x) => x !== id)
}

async function bulkAddAsNew() {
  bulk.value = 'new'
  let ok = 0
  const failed: string[] = []
  for (const r of pickedRows.value) {
    try {
      await promote(r.videoId, r.clip.id, { asNew: true, title: suggestedNewTitle(r.videoTitle, r.clip.operation, r.clip.segmentIndex) })
      ok++
    } catch (err) {
      failed.push(`${r.videoTitle ?? r.videoId}: ${apiErrorMessage(err)}`)
    }
  }
  bulk.value = null
  picked.value = []
  toast.add({
    title: `${ok} new video${ok === 1 ? '' : 's'} made${failed.length ? `, ${failed.length} failed` : ''}`,
    description: failed.length ? failed.join(' · ') : 'They are hidden until someone reviews and enables them.',
    color: failed.length ? 'warning' : 'success'
  })
  await load()
}

async function bulkDiscard() {
  bulk.value = 'discard'
  let failed = 0
  for (const r of pickedRows.value) {
    try {
      await remove(r.videoId, r.clip.id)
    } catch {
      failed++
    }
  }
  bulk.value = null
  confirmDiscard.value = false
  picked.value = []
  toast.add({ title: failed ? `Discarded, ${failed} failed` : 'Discarded', color: failed ? 'warning' : 'success' })
  await load()
}

async function discardOne(r: EditResultRow) {
  try {
    await remove(r.videoId, r.clip.id)
    rows.value = (rows.value ?? []).filter((x) => x.clip.id !== r.clip.id)
    toast.add({ title: 'Result discarded', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not discard it', description: apiErrorMessage(err), color: 'error' })
  }
}
</script>
