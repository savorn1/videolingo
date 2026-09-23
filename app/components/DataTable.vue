<template>
  <div>
    <div v-if="refreshable || exportable || (showColumnToggle && rows.length > 0)" class="flex justify-end items-center gap-2 mb-2">
      <UButton v-if="refreshable" size="xs" variant="soft" color="neutral" icon="i-lucide-refresh-cw" :loading="loading" @click="emit('refresh')">
        Refresh
      </UButton>

      <UDropdownMenu v-if="exportable && rows.length > 0" :items="exportItems">
        <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-download" trailing-icon="i-lucide-chevron-down"> Export </UButton>
      </UDropdownMenu>

      <UPopover v-if="showColumnToggle && rows.length > 0">
        <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-columns-3"> Columns </UButton>

        <template #content>
          <div class="p-3 space-y-2 min-w-[12rem]">
            <UCheckbox
              v-for="column in columns"
              :key="column.key"
              :model-value="!hiddenColumnKeys.has(column.key)"
              :label="column.label || humanize(column.key)"
              @update:model-value="(v: boolean | 'indeterminate') => setColumnVisible(column.key, v === true)"
            />
          </div>
        </template>
      </UPopover>
    </div>

    <div
      v-if="selectable && selected.length > 0"
      class="flex items-center justify-between gap-3 mb-3 rounded-lg bg-primary-50 dark:bg-primary-400/10 px-3 py-2"
    >
      <span class="text-sm text-primary-700 dark:text-primary-300 font-medium"> {{ selected.length }} selected </span>
      <div class="flex items-center gap-2">
        <slot name="bulk-actions" :selected="selected" :clear="() => (selected = [])" />
        <UButton size="xs" variant="ghost" color="neutral" @click="selected = []"> Clear selection </UButton>
      </div>
    </div>

    <div v-if="loading && rows.length === 0" class="space-y-3" role="status" aria-label="Loading">
      <div v-for="i in 6" :key="i" class="flex items-center gap-4 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-3">
        <USkeleton v-for="(column, colIndex) in skeletonColumns" :key="column.key" class="h-4" :class="colIndex === 0 ? 'w-1/4' : 'flex-1'" />
      </div>
    </div>

    <div v-else-if="rows.length === 0">
      <slot name="empty-state">
        <EmptyState icon="i-lucide-database" title="No data" />
      </slot>
    </div>

    <template v-else>
      <UTable
        :data="rows"
        :columns="uColumns"
        :loading="loading"
        :ui="tableUiWithHover"
        :meta="{ class: { tr: rowClass } }"
        class="hidden sm:block"
        @select="(_e: Event, row: { original: T }) => emit('select', row.original)"
      >
        <template v-if="selectable" #__select-header>
          <UCheckbox
            :model-value="allSelected"
            :indeterminate="someSelected"
            @update:model-value="(v: boolean | 'indeterminate') => toggleSelectAll(v === true)"
            @click.stop
          />
        </template>
        <template v-if="selectable" #__select-cell="{ row }">
          <UCheckbox
            :model-value="isSelected(row.original)"
            @update:model-value="(v: boolean | 'indeterminate') => toggleRow(row.original, v === true)"
            @click.stop
          />
        </template>

        <template v-if="numbered" #__rowNumber-header>No.</template>
        <template v-if="numbered" #__rowNumber-cell="{ row }">
          {{ rowNumberStart + row.index + 1 }}
        </template>

        <template v-for="column in visibleColumns" :key="column.key" #[`${column.key}-header`]>
          <button v-if="column.sortable" type="button" class="flex items-center gap-1 font-medium" :class="sortButtonClass" @click="toggleSort(column.key)">
            {{ column.label ?? humanize(column.key) }}
            <UIcon :name="sortIcon(column.key)" class="w-3.5 h-3.5" :class="sort?.column === column.key ? 'opacity-100' : 'opacity-30'" />
          </button>
          <span v-else>{{ column.label ?? humanize(column.key) }}</span>
        </template>

        <template v-for="column in visibleColumns" :key="column.key" #[`${column.key}-cell`]="{ row }">
          <slot :name="`${column.key}-data`" :row="row.original">
            <ColumnValue :column="column" :row="row.original" />
          </slot>
        </template>

        <template v-for="column in visibleColumns" :key="column.key" #[`${column.key}-footer`]>
          <span v-if="column.footer" class="font-semibold" :class="footerClass(column)">{{ footerText(column) }}</span>
        </template>
      </UTable>

      <!-- Mobile fallback: a horizontally-scrolling table is unreadable on narrow
           screens, so stack each row as a label/value card below `sm`. -->
      <div class="sm:hidden space-y-3">
        <div
          v-for="(row, index) in rows"
          :key="index"
          class="rounded-lg border border-gray-200 dark:border-gray-800 p-3"
          :class="{ 'active:bg-success/10 dark:active:bg-success/10': hasSelectListener }"
          @click="emit('select', row)"
        >
          <div v-for="column in visibleColumns" :key="column.key" class="flex items-start justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0">
            <span class="text-gray-500 dark:text-gray-400 shrink-0">{{ column.label ?? humanize(column.key) }}</span>
            <span class="text-right font-medium text-gray-900 dark:text-white min-w-0">
              <slot :name="`${column.key}-data`" :row="row">
                <ColumnValue :column="column" :row="row" />
              </slot>
            </span>
          </div>
        </div>
      </div>

      <!-- Mobile fallback has no native tfoot to piggyback on — surface the
           same totals as a small summary card below the stacked rows. -->
      <div v-if="hasFooterColumns" class="sm:hidden rounded-lg border border-gray-200 dark:border-gray-800 p-3 mt-3 space-y-1">
        <div v-for="column in visibleColumns.filter((c) => c.footer)" :key="column.key" class="flex items-center justify-between gap-3 text-sm">
          <span class="text-gray-500 dark:text-gray-400">{{ column.label ?? humanize(column.key) }}</span>
          <span class="font-semibold" :class="footerClass(column)">{{ footerText(column) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import type { ColumnDef } from '#shared/types'
import type { TableColumn } from '@nuxt/ui'

const props = withDefaults(
  defineProps<{
    rows: T[]
    columns: ColumnDef<T>[]
    loading?: boolean
    /** Lets users show/hide individual columns via a "Columns" popover. */
    columnsToggleable?: boolean
    /** Shows a "Refresh" button that emits `refresh` — the caller re-fetches. */
    refreshable?: boolean
    /** Adds a leading "No." column, numbered `rowNumberStart + index + 1`. */
    numbered?: boolean
    /** Offset for numbering, e.g. `(page - 1) * pageSize` so it stays continuous across pages. */
    rowNumberStart?: number
    /** Adds a checkbox column and a "N selected" bulk-actions bar (see the
     * `bulk-actions` slot) driven by `v-model:selected`. */
    selectable?: boolean
    /** Shows an "Export" menu (CSV / Excel / PDF / Copy) that exports the
     * currently-loaded `rows` (not the full server-side dataset), formatted
     * the same way each column renders on screen. */
    exportable?: boolean
    /** Base filename (without extension) for CSV/Excel/PDF exports. */
    exportFilename?: string
  }>(),
  {
    columnsToggleable: true,
    refreshable: false,
    numbered: false,
    rowNumberStart: 0,
    selectable: false,
    exportable: false,
    exportFilename: 'export'
  }
)

const toast = useToast()

const selected = defineModel<T[]>('selected', { default: () => [] })
const sort = defineModel<{ column: string; direction: 'asc' | 'desc' } | undefined>('sort')

const emit = defineEmits<{ select: [row: T]; refresh: [] }>()

// `select` is a declared emit, so Vue excludes its `onSelect` listener from
// `useAttrs()` (declared-emit listeners are consumed as component events,
// not fallthrough attrs) — that made this always evaluate to false. The raw
// vnode props aren't split that way, so reading the listener from there
// instead actually reflects whether a caller passed `@select`.
const instance = getCurrentInstance()
const hasSelectListener = computed(() => !!(instance?.vnode.props as { onSelect?: unknown } | null)?.onSelect)

// Hidden-by-key (not index) so visibility survives column list re-renders as
// long as keys stay the same.
const hiddenColumnKeys = ref<Set<string>>(new Set())

const showColumnToggle = computed(() => props.columnsToggleable && props.columns.length > 1)

const visibleColumns = computed(() => props.columns.filter((c) => !hiddenColumnKeys.value.has(c.key)))

const hasFooterColumns = computed(() => visibleColumns.value.some((c) => c.footer))
function footerText(column: ColumnDef<T>): string {
  if (!column.footer) return ''
  const footerFn = column.footer
  return formatColumnText({ ...column, value: () => footerFn(props.rows) }, {} as T)
}
// A function-typed `class` needs a row to evaluate against, which a totals
// row doesn't have one representative of — fall back to the default color.
function footerClass(column: ColumnDef<T>): string {
  return typeof column.class === 'string' ? column.class : 'text-gray-900 dark:text-white'
}

// Capped so a table with many columns doesn't render a wall of skeleton
// slivers — enough segments to read as "a row of data," no more.
const skeletonColumns = computed(() => visibleColumns.value.slice(0, 5))

function setColumnVisible(key: string, visible: boolean) {
  // Always leave at least one column visible — hiding the last one would
  // render an empty table with no way back to the toggle.
  if (!visible && visibleColumns.value.length <= 1) return
  const next = new Set(hiddenColumnKeys.value)
  if (visible) next.delete(key)
  else next.add(key)
  hiddenColumnKeys.value = next
}

function toggleSort(key: string) {
  if (sort.value?.column !== key) {
    sort.value = { column: key, direction: 'asc' }
  } else if (sort.value.direction === 'asc') {
    sort.value = { column: key, direction: 'desc' }
  } else {
    sort.value = undefined
  }
}

function sortIcon(key: string) {
  if (sort.value?.column !== key) return 'i-lucide-chevrons-up-down'
  return sort.value.direction === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
}

function isSelected(row: T) {
  return selected.value.includes(row)
}

function toggleRow(row: T, value: boolean) {
  selected.value = value ? [...selected.value, row] : selected.value.filter((r) => r !== row)
}

const allSelected = computed(() => props.rows.length > 0 && selected.value.length === props.rows.length)
const someSelected = computed(() => selected.value.length > 0 && !allSelected.value)

function toggleSelectAll(value: boolean) {
  selected.value = value ? [...props.rows] : []
}

const ROW_NUMBER_KEY = '__rowNumber'
const SELECT_KEY = '__select'

const { tableUi, rowEvenClass, sortButtonClass } = useTableTheme()

// Zebra striping — UTable styles every row uniformly, so alternating shading
// goes through `meta.class.tr`, which TanStack resolves per-row via `row.index`.
// Clickable rows (an @select listener) get a pointer cursor here — the hover
// *background* can't be set this way: UTable's own tbody-level selector
// (`[&>tr]:data-[selectable=true]:hover:bg-elevated/50`, see tableUiWithHover
// below) has higher specificity than a plain class on the `tr` itself, so a
// `hover:bg-*` added here would compile but never actually win and silently
// never render.
function rowClass(row: { index: number }) {
  const classes = [row.index % 2 === 1 ? rowEvenClass.value : '']
  if (hasSelectListener.value) {
    classes.push('cursor-pointer transition-colors')
  }
  return classes.filter(Boolean).join(' ')
}

// Overrides UTable's own tbody-level hover color (`hover:bg-elevated/50`) by
// replacing the same slot class Nuxt UI itself would generate — since this
// goes through the `:ui` prop, Table.vue's own class-merging (tailwind-merge)
// resolves the conflicting `hover:bg-*` utility instead of both classes
// fighting it out at matching specificity.
const tableUiWithHover = computed(() => ({
  ...tableUi.value,
  tbody: hasSelectListener.value
    ? 'isolate [&>tr]:data-[selectable=true]:hover:bg-success/10 [&>tr]:data-[selectable=true]:outline-primary/25 [&>tr]:data-[selectable=true]:focus-visible:outline-3 divide-y divide-default'
    : (tableUi.value as { tbody?: string }).tbody
}))

// Export: CSV / Excel / PDF / Copy, all client-side, all built from whatever's
// currently loaded in `rows` (not the full server-side dataset if the caller
// paginates) using the same per-column formatting ColumnValue renders on
// screen, so every export matches what's visible on screen.
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportHeaderAndRows(): { header: string[]; rows: string[][] } {
  const cols = visibleColumns.value
  const header = cols.map((c) => c.label ?? humanize(c.key))
  const bodyRows = props.rows.map((row) => cols.map((c) => formatColumnText(c, row)))
  return { header, rows: bodyRows }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportCsv() {
  const { header, rows } = exportHeaderAndRows()
  const lines = [header, ...rows].map((line) => line.map(csvEscape).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${props.exportFilename}.csv`)
}

async function exportExcel() {
  const { header, rows } = exportHeaderAndRows()
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  XLSX.writeFile(workbook, `${props.exportFilename}.xlsx`)
}

async function exportPdf() {
  const { header, rows } = exportHeaderAndRows()
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  // Landscape, since these tables tend to be wide (many columns).
  const doc = new JsPDF({ orientation: 'landscape' })
  autoTable(doc, { head: [header], body: rows, styles: { fontSize: 8 } })
  doc.save(`${props.exportFilename}.pdf`)
}

async function copyToTable() {
  const { header, rows } = exportHeaderAndRows()
  // Tab-separated so pasting into a spreadsheet lands one value per cell;
  // tabs/newlines inside a value would break that, so they're flattened to a
  // single space (rare in this app's data — ids, amounts, short text).
  const sanitize = (value: string) => value.replace(/[\t\n\r]+/g, ' ')
  const tsv = [header, ...rows].map((line) => line.map(sanitize).join('\t')).join('\n')
  try {
    await navigator.clipboard.writeText(tsv)
    toast.add({ title: 'Copied to clipboard', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy to clipboard', color: 'error' })
  }
}

const exportItems = [
  [
    { label: 'CSV', icon: 'i-lucide-file-text', onSelect: exportCsv },
    { label: 'Excel', icon: 'i-lucide-file-spreadsheet', onSelect: exportExcel },
    { label: 'PDF', icon: 'i-lucide-file-type', onSelect: exportPdf },
    { label: 'Copy', icon: 'i-lucide-copy', onSelect: copyToTable }
  ]
]

// Every column is a TanStack "display column" (id + header/cell only, no
// accessorKey) — value extraction is already handled by <ColumnValue> and
// formatColumnText(), so there's nothing for TanStack itself to accessor.
const uColumns = computed<TableColumn<T>[]>(() => {
  const cols: TableColumn<T>[] = []
  if (props.selectable) cols.push({ id: SELECT_KEY })
  if (props.numbered) cols.push({ id: ROW_NUMBER_KEY })
  for (const c of visibleColumns.value) {
    const tdClass = typeof c.class === 'function' ? (cell: { row: { original: T } }) => (c.class as (row: T) => string)(cell.row.original) : c.class
    cols.push({ id: c.key, meta: { class: { td: tdClass } }, ...(c.footer ? { footer: () => '' } : {}) })
  }
  return cols
})
</script>
