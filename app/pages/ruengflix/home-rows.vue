<template>
  <div>
    <PageHeader
      title="Home rows"
      description="The rows of series on RuengFlix's home page, top to bottom, below the hero and today's top 10. The site shows changes within a minute."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Home rows' }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />
    <UAlert
      v-if="!loading && !error && !rows.some((r) => r.active)"
      color="info"
      variant="subtle"
      class="mb-4"
      icon="i-lucide-info"
      title="No row is shown, so RuengFlix uses its built-in four: newest updates, then cultivation, romance and fantasy."
    />

    <UCard v-if="canWrite" class="mb-4">
      <template #header>
        <h2 class="font-semibold text-highlighted">{{ editing ? `Edit “${editing.title}”` : 'Add a row' }}</h2>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <UFormField label="Heading" required class="sm:col-span-2" hint="what viewers see, usually in Khmer">
          <UInput v-model="form.title" :maxlength="MAX_HOME_ROW_TITLE" placeholder="អាប់ដេតថ្មី" class="w-full" />
        </UFormField>
        <UFormField label="Series from" required>
          <USelect v-model="form.source" :items="HOME_ROW_SOURCES" class="w-full" />
        </UFormField>
        <UFormField v-if="form.source === 'CATEGORY'" label="Category" required>
          <USelect v-model="form.category" :items="SERIES_CATEGORIES" class="w-full" />
        </UFormField>
        <UFormField v-else-if="form.source === 'GENRE'" label="Genre" required hint="as written on the series">
          <UInput v-model="form.genre" maxlength="80" placeholder="យុទ្ធភពបុរាណ" class="w-full" />
        </UFormField>
        <div v-else class="hidden sm:block" />
        <UFormField label="Shows up to" :hint="`series (${HOME_ROW_ITEMS.min}–${HOME_ROW_ITEMS.max})`">
          <UInputNumber v-model="form.maxItems" :min="HOME_ROW_ITEMS.min" :max="HOME_ROW_ITEMS.max" class="w-full" />
        </UFormField>
        <UFormField label="Shown on the site">
          <USwitch v-model="form.active" />
        </UFormField>
        <p v-if="problem && tried" class="sm:col-span-2 text-sm text-error">{{ problem }}</p>
        <div class="sm:col-span-2 flex gap-2">
          <UButton type="submit" :loading="saving" :disabled="!editing && rows.length >= MAX_HOME_ROWS" icon="i-lucide-save">{{
            editing ? 'Save' : 'Add row'
          }}</UButton>
          <UButton v-if="editing" color="neutral" variant="ghost" @click="reset">Cancel</UButton>
          <span v-if="!editing && rows.length >= MAX_HOME_ROWS" class="self-center text-sm text-muted"
            >The home page has room for {{ MAX_HOME_ROWS }} rows.</span
          >
        </div>
      </form>
    </UCard>

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #position-data="{ row }">
          <div class="flex items-center gap-1">
            <span class="w-5 text-right tabular-nums text-muted">{{ at(row) + 1 }}</span>
            <template v-if="canWrite">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up"
                :aria-label="`Move “${row.title}” up`"
                :disabled="at(row) === 0 || ordering"
                @click="move(at(row), -1)"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                :aria-label="`Move “${row.title}” down`"
                :disabled="at(row) === rows.length - 1 || ordering"
                @click="move(at(row), 1)"
              />
            </template>
          </div>
        </template>
        <template #title-data="{ row }">
          <p class="font-medium text-highlighted">{{ row.title }}</p>
          <p class="text-xs text-muted">{{ describeHomeRow(row) }}</p>
        </template>
        <template #active-data="{ row }">
          <UBadge :color="row.active ? 'success' : 'neutral'" variant="subtle">{{ row.active ? 'Shown' : 'Hidden' }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <template v-if="canWrite">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-pencil" @click="edit(row)">Edit</UButton>
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :icon="row.active ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :loading="busyId === row.id"
              @click="toggle(row)"
            >
              {{ row.active ? 'Hide' : 'Show' }}
            </UButton>
            <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" :disabled="busyId === row.id" @click="remove(row)">Delete</UButton>
          </template>
        </template>
        <template #empty-state>
          <EmptyState icon="i-lucide-rows-3" title="No rows" description="RuengFlix shows its built-in rows. Add one above to choose your own." />
        </template>
      </DataTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { HomeRowInput, StreamingHomeRow } from '~/composables/useStreaming'
import {
  HOME_ROW_ITEMS,
  HOME_ROW_SOURCES,
  MAX_HOME_ROW_TITLE,
  MAX_HOME_ROWS,
  describeHomeRow,
  homeRowProblem,
  homeRowValue,
  type HomeRowForm
} from '#shared/utils/homeRows'
import { SERIES_CATEGORIES, type SeriesCategory } from '#shared/utils/streamingSeries'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const { doneWithUndo } = useUndoToast()
const { del } = useUndoableDelete()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingHomeRow[]>([])
const loading = ref(false)
const saving = ref(false)
const ordering = ref(false)
const tried = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)
const editing = ref<StreamingHomeRow | null>(null)

const blank = (): HomeRowForm => ({ title: '', source: 'CATEGORY', category: 'CULTIVATION', genre: '', maxItems: 12, active: true })
const form = reactive(blank())
const problem = computed(() => homeRowProblem(form))

const columns: ColumnDef<StreamingHomeRow>[] = [
  { key: 'position', label: '#' },
  { key: 'title', label: 'Row' },
  { key: 'active', label: 'Status' },
  { key: 'actions', label: '' }
]

/** The row's place in the list (the table's cells aren't told it) */
const at = (row: StreamingHomeRow) => rows.value.findIndex((r) => r.id === row.id)

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await streaming.homeRows()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

function reset() {
  editing.value = null
  tried.value = false
  Object.assign(form, blank())
}

function edit(row: StreamingHomeRow) {
  editing.value = row
  tried.value = false
  Object.assign(form, {
    title: row.title,
    source: row.source,
    category: row.source === 'CATEGORY' ? (row.value as SeriesCategory) : 'CULTIVATION',
    genre: row.source === 'GENRE' ? (row.value ?? '') : '',
    maxItems: row.maxItems,
    active: row.active
  })
  window.scrollTo({ top: 0, behavior: scrollMotion() })
}

async function save() {
  tried.value = true
  if (problem.value) return
  saving.value = true
  const body: HomeRowInput = { title: form.title.trim(), source: form.source, value: homeRowValue(form), maxItems: form.maxItems, active: form.active }
  try {
    if (editing.value) await streaming.updateHomeRow(editing.value.id, body)
    else await streaming.createHomeRow(body)
    toast.add({ title: editing.value ? 'Row saved' : 'Row added', description: 'RuengFlix shows it within a minute.', color: 'success' })
    reset()
    await load()
  } catch (err) {
    toast.add({ title: 'Could not save', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function move(index: number, by: -1 | 1) {
  const before = rows.value
  rows.value = moveItem(before, index, index + by)
  ordering.value = true
  try {
    rows.value = await streaming.orderHomeRows(rows.value.map((r) => r.id))
  } catch (err) {
    rows.value = before
    toast.add({ title: 'Could not move it', description: apiErrorMessage(err), color: 'error' })
  } finally {
    ordering.value = false
  }
}

async function toggle(row: StreamingHomeRow) {
  busyId.value = row.id
  try {
    await streaming.updateHomeRow(row.id, { active: !row.active })
    await load()
    doneWithUndo(row.active ? `“${row.title}” hidden` : `“${row.title}” shown`, {
      run: () => streaming.updateHomeRow(row.id, { active: row.active }),
      undone: row.active ? `“${row.title}” shown again` : `“${row.title}” hidden again`,
      failed: 'Could not undo',
      after: load
    })
  } catch (err) {
    toast.add({ title: 'Could not change it', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}

function remove(row: StreamingHomeRow) {
  const index = at(row)
  rows.value = rows.value.filter((r) => r.id !== row.id)
  if (editing.value?.id === row.id) reset()
  del(`“${row.title}”`, {
    commit: () => streaming.deleteHomeRow(row.id),
    restore: () => {
      const next = [...rows.value]
      next.splice(Math.max(0, index), 0, row)
      rows.value = next
    }
  })
}
</script>
