<template>
  <div>
    <PageHeader
      title="Sponsor ads"
      description="Short videos RuengFlix viewers can watch to unlock one VIP episode for free. How many a day is set under Prices (Ad unlocks a day)."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Sponsor ads' }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />
    <UAlert
      v-if="!loading && rows.length && !rows.some((r) => r.active)"
      color="warning"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-megaphone-off"
      title="No ad is active, so viewers don't see the “watch an ad” option."
    />

    <UCard v-if="canWrite" class="mb-4">
      <template #header>
        <h2 class="font-semibold text-highlighted">{{ editing ? `Edit “${editing.title}”` : 'Add an ad' }}</h2>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <UFormField label="Name" required class="sm:col-span-2">
          <UInput v-model="form.title" maxlength="120" placeholder="Sponsor — campaign" class="w-full" />
        </UFormField>
        <UFormField label="Video" required class="sm:col-span-2" :hint="uploading != null ? `Uploading ${Math.round(uploading * 100)}%` : 'MP4, 5–60 seconds'">
          <div class="flex gap-2">
            <UInput v-model="form.videoUrl" type="url" placeholder="https://…" icon="i-lucide-film" class="flex-1" aria-label="Video link" />
            <UploadButton label="Upload" accept="video/mp4,video/webm,video/quicktime" variant="ghost" :progress="uploading" @pick="upload" />
          </div>
        </UFormField>
        <UFormField label="“Learn more” link" hint="optional">
          <UInput v-model="form.clickUrl" type="url" placeholder="https://sponsor.example" class="w-full" />
        </UFormField>
        <UFormField label="Viewers watch" hint="seconds before the episode opens">
          <UInputNumber v-model="form.seconds" :min="5" :max="60" class="w-full" />
        </UFormField>
        <UFormField label="Weight" hint="higher shows more often (1–100)">
          <UInputNumber v-model="form.weight" :min="1" :max="100" class="w-full" />
        </UFormField>
        <UFormField label="Active">
          <USwitch v-model="form.active" />
        </UFormField>
        <div class="sm:col-span-2 flex gap-2">
          <UButton type="submit" :loading="saving" icon="i-lucide-save">{{ editing ? 'Save' : 'Add ad' }}</UButton>
          <UButton v-if="editing" color="neutral" variant="ghost" @click="reset">Cancel</UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #title-data="{ row }">
          <div class="flex items-center gap-3 min-w-0">
            <video :src="row.videoUrl" muted preload="metadata" class="w-20 aspect-video rounded bg-black object-cover shrink-0" />
            <div class="min-w-0">
              <p class="font-medium text-highlighted truncate">{{ row.title }}</p>
              <a v-if="row.clickUrl" :href="row.clickUrl" target="_blank" rel="noopener" class="text-xs text-muted hover:underline truncate block">{{
                row.clickUrl
              }}</a>
            </div>
          </div>
        </template>
        <template #active-data="{ row }">
          <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">{{ row.active ? 'Active' : 'Paused' }}</UBadge>
        </template>
        <template #completed-data="{ row }">
          <span>{{ row.completed }}</span>
          <span class="text-xs text-muted">
            / {{ row.started }} shown<template v-if="row.started"> · {{ Math.round((row.completed / row.started) * 100) }}%</template></span
          >
        </template>
        <template #actions-data="{ row }">
          <template v-if="canWrite">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="edit(row)">Edit</UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="row.active ? 'i-lucide-pause' : 'i-lucide-play'"
              :loading="busyId === row.id"
              @click="toggle(row)"
            >
              {{ row.active ? 'Pause' : 'Resume' }}
            </UButton>
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :loading="busyId === row.id" @click="remove(row)">Delete</UButton>
          </template>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-megaphone"
            title="No ads yet"
            description="Add a sponsor video above; viewers then get a free “watch an ad” option on the unlock screen."
          />
        </template>
      </DataTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { AdInput, StreamingAd } from '~/composables/useStreaming'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { uploadFile } = useVideos()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingAd[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)
const uploading = ref<number | null>(null)
const editing = ref<StreamingAd | null>(null)

const blank = () => ({ title: '', videoUrl: '', clickUrl: '', seconds: 15, weight: 1, active: true })
const form = reactive(blank())

const columns: ColumnDef<StreamingAd>[] = [
  { key: 'title', label: 'Ad' },
  { key: 'seconds', label: 'Seconds' },
  { key: 'weight' },
  { key: 'active', label: 'Status', value: (r) => (r.active ? 'Active' : 'Paused') },
  { key: 'completed', label: 'Unlocks', value: (r) => r.completed },
  { key: 'createdAt', label: 'Added', type: 'datetime' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await streaming.ads()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function upload(file: File) {
  if (!file.type.startsWith('video/')) {
    toast.add({ title: 'Choose a video file', color: 'warning' })
    return
  }
  uploading.value = 0
  try {
    const { publicUrl } = await uploadFile('VIDEO', file, { onProgress: (p) => (uploading.value = p) })
    form.videoUrl = publicUrl
  } catch (err) {
    toast.add({ title: 'Upload failed', description: apiErrorMessage(err), color: 'error' })
  } finally {
    uploading.value = null
  }
}

function reset() {
  editing.value = null
  Object.assign(form, blank())
}

function edit(row: StreamingAd) {
  editing.value = row
  Object.assign(form, { title: row.title, videoUrl: row.videoUrl, clickUrl: row.clickUrl ?? '', seconds: row.seconds, weight: row.weight, active: row.active })
  window.scrollTo({ top: 0, behavior: scrollMotion() })
}

async function save() {
  saving.value = true
  const body: AdInput = { ...form, clickUrl: form.clickUrl.trim() }
  try {
    if (editing.value) await streaming.updateAd(editing.value.id, body)
    else await streaming.createAd(body)
    toast.add({ title: editing.value ? 'Ad saved' : 'Ad added', color: 'success' })
    reset()
    await load()
  } catch (err) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function toggle(row: StreamingAd) {
  busyId.value = row.id
  try {
    await streaming.updateAd(row.id, { active: !row.active })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not change it', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

async function remove(row: StreamingAd) {
  if (!window.confirm(`Delete “${row.title}”? Its counts go with it; episodes it unlocked stay unlocked.`)) return
  busyId.value = row.id
  try {
    await streaming.deleteAd(row.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}
</script>
