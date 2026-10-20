<template>
  <div>
    <PageHeader
      title="Storage"
      description="What the videos' files take: each video's own file, the versions kept when a file was replaced, edit results waiting, voice-overs and exports."
      :crumbs="[{ label: 'Videos', to: '/videos' }, { label: 'Storage' }]"
    >
      <template #actions>
        <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="loading" @click="load">Refresh</UButton>
      </template>
    </PageHeader>

    <p v-if="error" class="mb-4 text-sm text-error-600 dark:text-error-400" role="alert">{{ error }}</p>

    <!-- The totals, by kind of file -->
    <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="storage-totals">
      <div v-for="t in tiles" :key="t.label" class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"><UIcon :name="t.icon" class="size-3.5" />{{ t.label }}</div>
        <div class="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-white">
          <USkeleton v-if="!data" class="h-7 w-16" />
          <template v-else>{{ formatFileSize(t.bytes) }}</template>
        </div>
        <div v-if="data && t.share !== null" class="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div class="h-full rounded-full bg-primary-500" :style="{ width: `${t.share * 100}%` }" />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <!-- The biggest videos -->
      <UCard class="lg:col-span-2" :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Taking the most space</h2>
        </template>
        <USkeleton v-if="!data" class="m-4 h-24" />
        <EmptyState v-else-if="!data.biggest.length" icon="i-lucide-hard-drive" title="Nothing stored yet" />
        <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800" data-testid="storage-biggest">
          <li v-for="r in data.biggest" :key="r.videoId" class="flex items-center gap-3 px-4 py-2">
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/videos/${r.videoId}`" class="block truncate text-sm font-medium text-gray-900 hover:underline dark:text-white">
                {{ r.title }}
              </NuxtLink>
              <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ parts(r) }}<template v-if="r.deleted"> · in the trash</template></p>
              <!-- Where the space goes, as a stacked bar -->
              <div class="mt-1 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden="true">
                <span v-for="seg in segments(r)" :key="seg.cls" :class="seg.cls" :style="{ width: `${seg.share * 100}%` }" />
              </div>
            </div>
            <span class="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ formatFileSize(rowTotal(r)) }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Clean-up -->
      <UCard v-if="canWrite" data-testid="storage-cleanup">
        <template #header>
          <h2 class="text-sm font-semibold text-gray-900 dark:text-white">Remove old versions</h2>
        </template>
        <div class="space-y-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            A version is the file a video had before an edit replaced it. Removing one frees its space; the video itself stays as it is now.
          </p>
          <UFormField label="Keep the newest">
            <USelect v-model="keepLatest" :items="KEEP_CHOICES" class="w-full" aria-label="Versions to keep" />
          </UFormField>
          <UFormField label="Remove only ones older than">
            <USelect v-model="olderThanDays" :items="AGE_CHOICES" class="w-full" aria-label="Minimum age" />
          </UFormField>
          <UButton color="error" variant="soft" icon="i-lucide-trash-2" :disabled="!data || !data.totals.versions" @click="confirming = true">
            Remove old versions
          </UButton>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="confirming" title="Remove old versions?" :description="confirmText">
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="confirming = false">Cancel</UButton>
          <UButton color="error" :loading="pruning" @click="prune">Remove them</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
// The storage report: totals by kind of file, the videos taking the most space, and removing old versions.
import type { StorageReport, StorageRow } from '~/composables/useStorageReport'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Storage' })

const { report, pruneVersions } = useStorageReport()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('videos', 'WRITE'))

const data = ref<StorageReport | null>(null)
const loading = ref(false)
const error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await report()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const tiles = computed(() => {
  const t = data.value?.totals
  const all = data.value?.totalBytes ?? 0
  const share = (n: number) => (all ? n / all : 0)
  return [
    { label: 'All files', icon: 'i-lucide-hard-drive', bytes: all, share: null },
    { label: 'Videos', icon: 'i-lucide-video', bytes: t?.files ?? 0, share: share(t?.files ?? 0) },
    { label: 'Versions', icon: 'i-lucide-history', bytes: t?.versions ?? 0, share: share(t?.versions ?? 0) },
    { label: 'Edit results', icon: 'i-lucide-list-checks', bytes: t?.results ?? 0, share: share(t?.results ?? 0) },
    { label: 'Voice-overs', icon: 'i-lucide-mic', bytes: t?.dubs ?? 0, share: share(t?.dubs ?? 0) },
    { label: 'Exports', icon: 'i-lucide-download', bytes: t?.exports ?? 0, share: share(t?.exports ?? 0) }
  ]
})

const rowTotal = (r: StorageRow) => r.fileBytes + r.versionBytes + r.resultBytes + r.dubBytes + r.exportBytes
function parts(r: StorageRow) {
  const out = [`video ${formatFileSize(r.fileBytes)}`]
  if (r.versions) out.push(`${r.versions} version${r.versions === 1 ? '' : 's'} ${formatFileSize(r.versionBytes)}`)
  if (r.results) out.push(`${r.results} result${r.results === 1 ? '' : 's'} ${formatFileSize(r.resultBytes)}`)
  if (r.dubBytes) out.push(`voice-overs ${formatFileSize(r.dubBytes)}`)
  if (r.exportBytes) out.push(`exports ${formatFileSize(r.exportBytes)}`)
  return out.join(' · ')
}
// Literal classes, so Tailwind sees them.
function segments(r: StorageRow) {
  const total = rowTotal(r) || 1
  return [
    { cls: 'bg-primary-500', share: r.fileBytes / total },
    { cls: 'bg-amber-500', share: r.versionBytes / total },
    { cls: 'bg-sky-500', share: r.resultBytes / total },
    { cls: 'bg-emerald-500', share: r.dubBytes / total },
    { cls: 'bg-violet-500', share: r.exportBytes / total }
  ]
}

// ── Clean-up ──
const KEEP_CHOICES = [0, 1, 2, 3, 5].map((n) => ({ label: n === 0 ? 'None' : `${n} of each video`, value: n }))
const AGE_CHOICES = [
  { label: 'Any age', value: 0 },
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: 'A year', value: 365 }
]
const keepLatest = ref(1)
const olderThanDays = ref(30)
const confirming = ref(false)
const pruning = ref(false)
const confirmText = computed(
  () =>
    `Every video keeps its newest ${keepLatest.value === 0 ? 'none' : keepLatest.value} version${keepLatest.value === 1 ? '' : 's'}; older ones${
      olderThanDays.value ? ` made more than ${olderThanDays.value} days ago` : ''
    } are deleted with their files. This can't be undone.`
)
async function prune() {
  pruning.value = true
  try {
    const r = await pruneVersions(keepLatest.value, olderThanDays.value)
    toast.add({
      title: r.removed ? `${r.removed} old version${r.removed === 1 ? '' : 's'} removed` : 'No versions were old enough to remove',
      description: r.removed ? `${formatFileSize(r.freedBytes)} freed.` : undefined,
      color: 'success'
    })
    confirming.value = false
    await load()
  } catch (err) {
    toast.add({ title: 'Could not remove the versions', description: apiErrorMessage(err), color: 'error' })
  } finally {
    pruning.value = false
  }
}
</script>
