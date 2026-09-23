<template>
  <div>
    <PageHeader
      title="Languages"
      description="Languages videos and transcripts can be in. Disabled languages stay on existing content but can't be picked for new content."
    >
      <template #actions>
        <UButton icon="i-lucide-plus" @click="openCreate">New language</UButton>
      </template>
    </PageHeader>

    <UCard class="mb-4">
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Search name or code" icon="i-lucide-search" class="w-64" />
        <USelect v-model="filter.enabled" :items="statusFilterOptions" placeholder="Status" class="w-36" />
        <UButton v-if="hasActiveFilter" size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
      </div>
    </UCard>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable v-model:sort="sort" :rows="rows" :columns="columns" :loading="loading" refreshable exportable export-filename="languages" @refresh="load">
        <template #name-data="{ row }">
          <div class="flex items-center gap-2 min-w-0">
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 dark:text-white truncate">{{ row.name }}</p>
              <p v-if="row.nativeName && row.nativeName !== row.name" class="text-xs text-gray-500 truncate">{{ row.nativeName }}</p>
            </div>
            <UBadge v-if="row.isDefault" color="primary" variant="subtle" icon="i-lucide-star" size="sm">Default</UBadge>
          </div>
        </template>

        <template #code-data="{ row }">
          <code class="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{{ row.code }}</code>
        </template>

        <template #usage-data="{ row }">
          <div class="flex items-center gap-3 text-sm whitespace-nowrap tabular-nums">
            <NuxtLink
              v-if="row.videoCount"
              :to="`/videos?language=${encodeURIComponent(row.code)}`"
              class="text-primary-600 dark:text-primary-400 hover:underline"
              @click.stop
            >
              {{ row.videoCount }} video{{ row.videoCount === 1 ? '' : 's' }}
            </NuxtLink>
            <NuxtLink
              v-if="row.transcriptCount"
              :to="`/transcripts?language=${encodeURIComponent(row.code)}`"
              class="text-primary-600 dark:text-primary-400 hover:underline"
              @click.stop
            >
              {{ row.transcriptCount }} transcript{{ row.transcriptCount === 1 ? '' : 's' }}
            </NuxtLink>
            <span v-if="!row.videoCount && !row.transcriptCount" class="text-gray-400">Unused</span>
          </div>
        </template>

        <template #actions-data="{ row }">
          <div class="min-w-max" @click.stop>
            <RowActions :actions="rowActions(row)" :max="1" />
          </div>
        </template>

        <template #empty-state>
          <EmptyState
            v-if="hasActiveFilter"
            icon="i-lucide-search-x"
            title="No languages match your filters"
            description="Try a different search or clear your filters."
          >
            <template #action>
              <UButton color="neutral" variant="soft" icon="i-lucide-x" @click="clearFilters">Clear filters</UButton>
            </template>
          </EmptyState>
          <EmptyState v-else icon="i-lucide-languages" title="No languages yet" description="Add the languages your videos are spoken in and translated to.">
            <template #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New language</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>

      <div v-if="total > pageSize" class="pt-4">
        <DataPagination v-model:page="page" v-model:page-size="pageSize" :total="total" />
      </div>
    </UCard>

    <!-- Create / edit -->
    <UModal v-model:open="showForm" :title="editing ? `Edit ${editing.name}` : 'New language'" :ui="{ content: 'sm:max-w-lg' }">
      <template #body>
        <DynamicForm
          v-model="form"
          :fields="formFields"
          :loading="saving"
          :error="formError"
          :submit-label="editing ? 'Save changes' : 'Create'"
          cancelable
          @submit="onSubmit"
          @cancel="showForm = false"
        />
      </template>
    </UModal>

    <ConfirmModal
      :model-value="pending !== null"
      :title="pending?.title ?? ''"
      :description="pending?.description ?? ''"
      :confirm-label="pending?.confirmLabel ?? ''"
      :color="pending?.color ?? 'primary'"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (pending = null)"
      @confirm="runPending"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FieldDef, RowAction } from '#shared/types'
import type { Language } from '~/composables/useLanguages'

definePageMeta({ middleware: 'admin' })

const { list, create, update, setEnabled, setDefault, remove } = useLanguages()
const toast = useToast()

const rows = ref<Language[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const filter = reactive<{ enabled: boolean | undefined }>({ enabled: undefined })
const search = ref('')
const page = ref(1)
const pageSize = ref(50)
const sort = ref<{ column: string; direction: 'asc' | 'desc' } | undefined>({ column: 'name', direction: 'asc' })

useListQuerySync({ filter, search, page })

const statusFilterOptions = [
  { label: 'All statuses', value: undefined },
  { label: 'Enabled', value: true },
  { label: 'Disabled', value: false }
]

const columns: ColumnDef<Language>[] = [
  { key: 'name', sortable: true },
  { key: 'code', sortable: true },
  { key: 'enabled', label: 'Status', type: 'boolean', sortable: true, trueLabel: 'Enabled', falseLabel: 'Disabled', falseColor: 'warning' },
  { key: 'usage', label: 'Used by', value: (row) => `${row.videoCount} videos, ${row.transcriptCount} transcripts` },
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
      enabled: filter.enabled,
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

const hasActiveFilter = computed(() => search.value !== '' || filter.enabled !== undefined)
function clearFilters() {
  search.value = ''
  debouncedSearch.value = ''
  filter.enabled = undefined
}

onMounted(load)

// ── Create / edit ──────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Language | null>(null)
const saving = ref(false)
const formError = ref('')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const form = ref<Record<string, any>>({})

const formFields = computed<FieldDef[]>(() => {
  const inUse = !!editing.value && editing.value.videoCount + editing.value.transcriptCount > 0
  return [
    {
      name: 'code',
      required: true,
      maxLength: 10,
      placeholder: 'e.g. km, ja, pt-BR',
      icon: 'i-lucide-hash',
      // Code is how videos/transcripts reference the language — locked once used.
      disabled: inUse,
      hint: inUse ? 'Locked — videos or transcripts use this code.' : 'ISO 639 code, optionally with a region: "pt-BR".'
    },
    { name: 'name', label: 'Name (English)', required: true, maxLength: 100, placeholder: 'e.g. Khmer' },
    { name: 'nativeName', label: 'Native name', maxLength: 100, placeholder: 'e.g. ភាសាខ្មែរ', wrapper: editing.value ? 'full' : 'half' },
    ...(editing.value ? [] : [{ name: 'enabled', label: 'Status', type: 'switch', onLabel: 'Enabled', offLabel: 'Disabled', default: true } satisfies FieldDef])
  ]
})

function openCreate() {
  editing.value = null
  form.value = { enabled: true }
  formError.value = ''
  showForm.value = true
}

function openEdit(row: Language) {
  editing.value = row
  form.value = { code: row.code, name: row.name, nativeName: row.nativeName ?? '' }
  formError.value = ''
  showForm.value = true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onSubmit(values: Record<string, any>) {
  saving.value = true
  formError.value = ''
  try {
    const payload = { code: String(values.code ?? '').trim(), name: String(values.name ?? '').trim(), nativeName: values.nativeName?.trim() || undefined }
    if (editing.value) {
      await update(editing.value.id, payload)
      toast.add({ title: 'Language updated', color: 'success' })
    } else {
      const created = await create({ ...payload, enabled: values.enabled ?? true })
      toast.add({ title: `${created.name} added`, color: 'success' })
    }
    showForm.value = false
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

// ── Row actions ────────────────────────────────────────────────────────────
interface PendingAction {
  title: string
  description: string
  confirmLabel: string
  color: 'primary' | 'warning' | 'error'
  run: () => Promise<unknown>
  success: string
}
const pending = ref<PendingAction | null>(null)
const busy = ref(false)

function rowActions(row: Language): RowAction[] {
  const actions: RowAction[] = [{ label: 'Edit', icon: 'i-lucide-pencil', color: 'primary', onClick: () => openEdit(row) }]
  if (!row.isDefault && row.enabled) actions.push({ label: 'Set as default', icon: 'i-lucide-star', onClick: () => confirmSetDefault(row) })
  if (row.enabled) actions.push({ label: 'Disable', icon: 'i-lucide-eye-off', color: 'warning', onClick: () => confirmDisable(row) })
  else actions.push({ label: 'Enable', icon: 'i-lucide-eye', color: 'success', onClick: () => quickEnable(row) })
  actions.push({ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onClick: () => confirmDelete(row) })
  return actions
}

// A blocked action explains itself (and offers the alternative) instead of
// silently disappearing from the menu.
function explainBlocked(reason: string, row: Language, offerDisable: boolean) {
  toast.add({
    title: `Can't do that to ${row.name}`,
    description: reason,
    color: 'warning',
    actions: offerDisable && row.enabled && !row.disableBlockedReason ? [{ label: 'Disable instead', onClick: () => confirmDisable(row) }] : undefined
  })
}

function confirmSetDefault(row: Language) {
  const current = rows.value.find((l) => l.isDefault)
  pending.value = {
    title: 'Set default language',
    description: `Make ${row.name} the default${current ? ` instead of ${current.name}` : ''}? The default is pre-selected for new content and can't be disabled or deleted.`,
    confirmLabel: 'Set as default',
    color: 'primary',
    run: () => setDefault(row.id),
    success: `${row.name} is now the default`
  }
}

function confirmDisable(row: Language) {
  if (row.disableBlockedReason) return explainBlocked(`${row.disableBlockedReason} — make another language the default first.`, row, false)
  const used = row.videoCount + row.transcriptCount
  pending.value = {
    title: `Disable ${row.name}`,
    description: used
      ? `${row.name} stays on the ${row.videoCount} video(s) and ${row.transcriptCount} transcript(s) that use it, but can't be chosen for anything new.`
      : `${row.name} will no longer be offered when choosing a language.`,
    confirmLabel: 'Disable',
    color: 'warning',
    run: () => setEnabled(row.id, false),
    success: `${row.name} disabled`
  }
}

async function quickEnable(row: Language) {
  try {
    await setEnabled(row.id, true)
    toast.add({ title: `${row.name} enabled`, color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not enable language', description: apiErrorMessage(err), color: 'error' })
  }
}

function confirmDelete(row: Language) {
  if (row.deleteBlockedReason) return explainBlocked(row.deleteBlockedReason, row, !row.isDefault)
  pending.value = {
    title: `Delete ${row.name}`,
    description: `Delete ${row.name} (${row.code})? Nothing uses it, so nothing else changes. This cannot be undone.`,
    confirmLabel: 'Delete',
    color: 'error',
    run: () => remove(row.id),
    success: `${row.name} deleted`
  }
}

async function runPending() {
  const p = pending.value
  if (!p) return
  busy.value = true
  try {
    await p.run()
    toast.add({ title: p.success, color: 'success' })
    pending.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'That didn’t work', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>
