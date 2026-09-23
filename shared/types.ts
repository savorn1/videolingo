// Cross-cutting types used by more than one feature — keep this file small.
// Ported from loan-frontend's Backpack-for-Laravel-style field/column system:
// https://backpackforlaravel.com/docs/7.x/crud-fields and crud-columns.

// Shared error shape (matches the GlobalExceptionHandler pattern used by this
// team's backend services).
export interface ApiErrorBody {
  statusCode: number
  message: string
  errors?: Record<string, string>
}

// ── Backend response envelopes ────────────────────────────────────────────
// Every controller wraps its payload in one of these two shapes (see
// ApiResponse<T>/PageResponse<T> on the backend) — every composable's api<T>()
// call is typed against one of them.
export interface ApiEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T
}

export interface PageEnvelope<T> {
  traceId: string
  statusCode: number
  message: string
  data: T[]
  metadata: { hasNext: boolean; hasPrev: boolean; totalPage: number; currentPage: number; limit: number; totalCount: number }
}

// Result of a bulk CSV import (see ImportResultResponse on the backend) —
// shared by useProducts/useCustomers/useSuppliers' importCsv() and rendered
// generically by CsvImportModal.vue.
export interface ImportResult {
  totalRows: number
  successCount: number
  failureCount: number
  errors: { rowNumber: number; message: string }[]
}

// All fields optional — an empty payload means "send to whichever email is
// already on file, with the default subject/body." Shared by
// useInvoices/useQuotations/usePurchaseOrders' emailDocument() and
// EmailDocumentModal.vue.
export interface SendDocumentEmailPayload {
  to?: string
  subject?: string
  message?: string
}

// ── Declarative form fields ───────────────────────────────────────────────
// `name` is the only mandatory attribute; `label` is auto-humanized from the
// name when omitted; `type` defaults to 'text'. Rendered by <Field> (one
// input) and <DynamicForm> (a whole form).
//
// Lean subset of loan-frontend's FieldType — add more `fields/Field*.vue`
// components and wire them into Field.vue's CONTROLS map to extend this.
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'email'
  | 'password'
  | 'url'
  | 'select'
  | 'combobox'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'hidden'

export interface FieldOption {
  label: string
  // undefined is a legitimate option value (e.g. an "Inherit"/"Default" choice
  // that clears the field), not an absent one.
  value: string | number | boolean | undefined
}

export interface FieldDef {
  /** The only mandatory attribute — key in the form's value object. */
  name: string
  /** Auto-humanized from `name` when omitted. */
  label?: string
  /** Defaults to 'text'. */
  type?: FieldType
  /** Helper text shown under the input. */
  hint?: string
  placeholder?: string
  /** Leading icon (an Iconify name, e.g. 'i-lucide-user'). */
  icon?: string
  /** Text shown before/after the input. */
  prefix?: string
  suffix?: string
  /** text: native maxlength constraint. */
  maxLength?: number
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  /** select / combobox / multiselect / radio choices. combobox is a select with a search box — use it for long option lists; multiselect picks several (value is an array). */
  options?: FieldOption[]
  /** number / date constraints. */
  min?: number | string
  max?: number | string
  step?: number | string
  /** textarea rows. */
  rows?: number
  /** switch: text shown next to the toggle for its true/false state. */
  onLabel?: string
  offLabel?: string
  /** Initial value applied by DynamicForm when the model has none. */
  default?: unknown
  /** Layout in DynamicForm's row grid — full row, half a row, or a third of a row. Defaults to 'half'. */
  wrapper?: 'full' | 'half' | 'third'
  /** Hide the field (and skip its `required` check) when this returns false for the current form values. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  showIf?: (values: Record<string, any>) => boolean
}

// ── Declarative list columns ──────────────────────────────────────────────
// `key` is the only mandatory attribute, `label` is auto-humanized when
// omitted, `type` defaults to 'text'. Rendered by <ColumnValue> (one cell)
// and <DataTable> (a whole table, wrapping Nuxt UI's <UTable>).

export type ColumnType = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'enum' | 'status' | 'boolean' | 'badge' | 'link'

// `any` here (not `unknown`) is deliberate: it's the default used only when a
// caller doesn't parameterize ColumnDef (e.g. <ColumnValue>'s untyped prop).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ColumnDef<T = any> {
  /** The only mandatory attribute — row property to read. */
  key: string
  /** Auto-humanized from `key` when omitted. */
  label?: string
  /** Defaults to 'text'. */
  type?: ColumnType
  sortable?: boolean
  /** Cell CSS class, or a function of the row for per-row conditional styling (e.g. sign-based color). */
  class?: string | ((row: T) => string)
  /** Derives the cell's value instead of reading row[key]. */
  value?: (row: T) => unknown
  /** Combines with `key` into a "from – to" range, e.g. key: 'minAmount', to: 'maxAmount'. */
  to?: string
  /** Text shown in place of an empty/null `to` value in a range (default '—'). */
  toEmpty?: string
  /** currency/range: text shown before the formatted value, e.g. a currency code. */
  prefix?: (row: T) => string
  /** text/number/percent/range: text appended after the value, e.g. a unit label. */
  suffix?: string | ((row: T) => string)
  /** boolean/badge: badge color (Nuxt UI semantic color name), or a function of the row. */
  color?: string | ((row: T) => string)
  /** boolean: label/color when the value is truthy (defaults: 'Yes', 'success'). */
  trueLabel?: string
  trueColor?: string
  /** boolean: label/color when falsy (defaults: 'No', 'neutral'). Set to '' to render nothing. */
  falseLabel?: string
  falseColor?: string
  /** link: destination path for the row. */
  href?: (row: T) => string
  /** Shows a totals/footer row for this column, computed from every currently-loaded row
   * (not just the visible page) — formatted the same way `type`/`prefix`/`suffix` format a cell. */
  footer?: (rows: T[]) => unknown
}

// ── Row actions ────────────────────────────────────────────────────────────
// One entry in a DataTable row's action buttons. Rendered by <RowActions>,
// which shows the first `max` inline and collapses the rest into a "…" menu.
export interface RowAction {
  label: string
  icon: string
  color?: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
  /** Shows a spinner in place of the icon — for an action with its own async in-flight state. */
  loading?: boolean
  onClick: () => void
}
