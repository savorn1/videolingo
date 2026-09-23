import type { ColumnDef, ColumnType } from '#shared/types'

export function formatColumnText<T extends Record<string, unknown>>(column: ColumnDef<T>, row: T): string {
  const rawValue = column.value ? column.value(row) : row[column.key]
  const prefix = column.prefix ? column.prefix(row) : ''
  const suffix = typeof column.suffix === 'function' ? column.suffix(row) : (column.suffix ?? '')
  const from = formatSingle(column.type, rawValue)
  if (!column.to) return `${prefix}${from}${suffix}`
  const toValue = row[column.to]
  const to = isEmpty(toValue) ? (column.toEmpty ?? '—') : formatSingle(column.type, toValue)
  return `${prefix}${from} – ${to}${suffix}`
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === ''
}

// Forces a compile error here if ColumnType ever gains a variant that isn't
// wired into this switch.
function assertNever(value: never): never {
  throw new Error(`Unhandled ColumnType: ${value}`)
}

function formatSingle(columnType: ColumnType | undefined, value: unknown): string {
  const type = columnType ?? 'text'
  switch (type) {
    case 'currency':
      return formatCurrency(value as number)
    case 'percent':
      return isEmpty(value) ? '—' : `${value}%`
    case 'date':
      return formatDate(value as string)
    case 'datetime':
      return formatDateTime(value as string)
    case 'enum':
      return formatEnum(value as string)
    case 'text':
    case 'number':
    case 'status':
    case 'link':
    case 'boolean':
    case 'badge':
      return isEmpty(value) ? '—' : String(value)
    default:
      return assertNever(type)
  }
}
