<template>
  <div>
    <PageHeader title="Tags" description="Free-form labels on videos. Add them to a video from its page, or to several videos at once from here.">
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openForm(null)">New tag</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search tags" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.unused" :items="usageFilterOptions" placeholder="Usage" class="w-40" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable v-model:sort="sort" :rows="rows" :columns="columns" :loading="loading" refreshable exportable export-filename="tags" @refresh="load">
        <template #name-data="{ row }">
          <div class="min-w-0 max-w-sm">
            <TagChip :name="row.name" />
            <p v-if="row.description" class="text-xs text-gray-500 mt-1 truncate" :title="row.description">{{ row.description }}</p>
          </div>
        </template>
        <template #slug-data="{ row }">
          <code class="text-xs font-mono text-gray-500">{{ row.slug }}</code>
        </template>
        <template #videoCount-data="{ row }">
          <NuxtLink v-if="row.videoCount" :to="`/videos?tagId=${row.id}`" class="tabular-nums text-primary-600 dark:text-primary-400 hover:underline">
            {{ row.videoCount }} video{{ row.videoCount === 1 ? '' : 's' }}
          </NuxtLink>
          <span v-else class="text-gray-400">Unused</span>
        </template>
        <template #actions-data="{ row }">
          <div class="min-w-max">
            <RowActions :actions="rowActions(row)" :max="1" />
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No tags match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-hash" title="No tags yet" description="Create tags here, or type one straight onto a video.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openForm(null)">New tag</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <!-- Create / edit -->
    <UModal v-model:open="showForm" :title="editing ? `Edit #${editing.name}` : 'New tag'" :ui="{ content: 'sm:max-w-md' }">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField label="Name" required :hint="`${[...formName].length}/50`">
            <UInput v-model="form.name" icon="i-lucide-hash" placeholder="e.g. beginner, slang, JLPT N5" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Slug" :hint="editing ? 'Changing it breaks old links' : 'optional'">
            <UInput v-model="form.slug" :placeholder="editing?.slug ?? 'generated from the name'" icon="i-lucide-link" class="w-full font-mono" />
          </UFormField>
          <UFormField label="Description" hint="optional">
            <UTextarea v-model="form.description" :rows="2" maxlength="300" class="w-full" />
          </UFormField>
          <UAlert v-if="formError" color="error" variant="subtle" :title="formError" icon="i-lucide-triangle-alert" />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showForm = false">Cancel</UButton>
            <UButton type="submit" :loading="saving" :disabled="!formName || [...formName].length > 50">{{ editing ? 'Save changes' : 'Create' }}</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Assign to videos -->
    <UModal v-model:open="showAssign" :title="`Add #${assigning?.name ?? ''} to videos`" :ui="{ content: 'sm:max-w-lg' }">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Videos" description="Videos that already have this tag are skipped.">
            <USelectMenu
              v-model="assignVideoIds"
              :items="videoOptions"
              value-key="value"
              multiple
              placeholder="Choose videos"
              aria-label="Videos to tag"
              :search-input="{ placeholder: 'Search videos…' }"
              :loading="videosLoading"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showAssign = false">Cancel</UButton>
            <UButton icon="i-lucide-hash" :loading="saving" :disabled="!assignVideoIds.length" @click="onAssign">
              Add to {{ assignVideoIds.length || '' }} video{{ assignVideoIds.length === 1 ? '' : 's' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete tag"
      :description="
        confirmDelete?.videoCount
          ? `Delete #${confirmDelete.name}? It will be removed from ${confirmDelete.videoCount} video(s) — the videos themselves are kept.`
          : `Delete #${confirmDelete?.name ?? ''}? No videos use it.`
      "
      confirm-label="Delete"
      color="error"
      :loading="saving"
      @update:model-value="(v: boolean) => !v && !saving && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import type { Tag } from '~/composables/useTags'

definePageMeta({ middleware: 'admin' })

const { list, create, update, remove, assignToVideo } = useTags()
const { list: listVideos } = useVideos()
const toast = useToast()

const rows = ref<Tag[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ unused: boolean | undefined }>({ unused: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'name', direction: 'asc' })

useListQuerySync({ filter, search, page })

const usageFilterOptions = [
  { label: 'Any usage', value: undefined },
  { label: 'In use', value: false },
  { label: 'Unused', value: true }
]

const columns: ColumnDef<Tag>[] = [
  { key: 'name', sortable: true },
  { key: 'slug', sortable: true },
  { key: 'videoCount', label: 'Videos', value: (row) => String(row.videoCount ?? 0) },
  { key: 'updatedAt', label: 'Updated', type: 'datetime', sortable: true },
  { key: 'actions', label: '' }
]

let requestSeq = 0
async function load() {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const res = await list({
      search: search.value.trim() || undefined,
      unused: filter.unused,
      sortBy: sort.value?.column,
      sortOrder: sort.value?.direction,
      page: page.value,
      size: pageSize.value
    })
    if (seq !== requestSeq) return
    rows.value = res.data
    total.value = res.metadata.totalCount
  } catch (err) {
    if (seq === requestSeq) error.value = apiErrorMessage(err)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const debouncedSearch = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (debouncedSearch.value = value), 300)
})
watch([() => ({ ...filter }), debouncedSearch, sort, pageSize], () => {
  page.value = 1
})
watch([() => ({ ...filter }), debouncedSearch, sort, page, pageSize], load)

const hasActiveFilter = computed(() => search.value !== '' || filter.unused !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.unused = undefined
}

onMounted(load)

function rowActions(row: Tag): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openForm(row) },
    { label: 'Add to videos…', icon: 'i-lucide-hash', onClick: () => openAssign(row) },
    ...(row.videoCount ? [{ label: 'View videos', icon: 'i-lucide-clapperboard', onClick: () => navigateTo(`/videos?tagId=${row.id}`) }] : []),
    { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => (confirmDelete.value = row) }
  ]
}

// ── Create / edit ──────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Tag | null>(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ name: '', slug: '', description: '' })
const formName = computed(() => normalizeTagName(form.name))

function openForm(row: Tag | null) {
  editing.value = row
  Object.assign(form, { name: row?.name ?? '', slug: '', description: row?.description ?? '' })
  formError.value = ''
  showForm.value = true
}

async function onSubmit() {
  saving.value = true
  formError.value = ''
  try {
    const payload = { name: formName.value, slug: form.slug.trim() || undefined, description: form.description.trim() || undefined }
    if (editing.value) await update(editing.value.id, payload)
    else await create(payload)
    toast.add({ title: editing.value ? 'Tag updated' : `#${formName.value} created`, color: 'success' })
    showForm.value = false
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

// ── Assign to several videos ───────────────────────────────────────────────
const showAssign = ref(false)
const assigning = ref<Tag | null>(null)
const assignVideoIds = ref<number[]>([])
const videos = ref<{ id: number; title: string; tags: { id: number }[] }[]>([])
const videosLoading = ref(false)
const videoOptions = computed(() =>
  videos.value.map((v) => ({
    label: v.tags.some((t) => t.id === assigning.value?.id) ? `${v.title} (already tagged)` : v.title,
    value: v.id,
    disabled: v.tags.some((t) => t.id === assigning.value?.id)
  }))
)

async function openAssign(row: Tag) {
  assigning.value = row
  assignVideoIds.value = []
  showAssign.value = true
  videosLoading.value = true
  try {
    videos.value = (await listVideos({ size: 500, sortBy: 'title', sortOrder: 'asc' })).data
  } catch {
    videos.value = []
  } finally {
    videosLoading.value = false
  }
}

// One request per video (the assign endpoint is per-video); reports partial failures.
async function onAssign() {
  const tag = assigning.value
  if (!tag) return
  saving.value = true
  const results = await Promise.allSettled(assignVideoIds.value.map((id) => assignToVideo(id, [tag.id])))
  saving.value = false
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
  const ok = results.length - failed.length
  if (ok) toast.add({ title: `#${tag.name} added to ${ok} video(s)`, color: 'success' })
  if (failed.length) toast.add({ title: `${failed.length} video(s) not tagged`, description: apiErrorMessage(failed[0]!.reason), color: 'error' })
  if (!failed.length) showAssign.value = false
  await load()
}

// ── Delete ─────────────────────────────────────────────────────────────────
const confirmDelete = ref<Tag | null>(null)
async function onDelete(row: Tag) {
  saving.value = true
  try {
    const detached = await remove(row.id)
    toast.add({ title: `#${row.name} deleted`, description: detached ? `Removed from ${detached} video(s).` : undefined, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete tag', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>
