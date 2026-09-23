// Auto-imported by Nuxt (files under shared/utils are isomorphic, client + server).

// `currencyCode` defaults to 'USD' so every existing call site keeps
// behaving exactly as before — pass it explicitly only where the amount's
// own currency is actually known (e.g. a document's optional foreign
// currency, or a company/bank account's own declared currency). This is
// deliberately not a global "make every money display currency-aware"
// change — most pages have no company/document context to know which
// currency they'd even pass.
export function formatCurrency(value: number | null | undefined, currencyCode: string = 'USD'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(value)
}

// For headline figures (stat tiles) that have limited width to work with —
// full precision (formatCurrency) truncates ($1,000,035.00 → "$1,000,035…")
// instead of just showing a shorter, still-accurate number ($1.0M).
export function formatCurrencyCompact(value: number | null | undefined, currencyCode: string = 'USD'): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

// Backend LocalDateTime values arrive with no timezone suffix (e.g. "2026-08-08T14:09:07"),
// which the JS Date parser treats as local time — local to whichever environment reads it.
// That differs between SSR (the server's timezone) and the browser (the viewer's), shifting
// the displayed value and causing hydration mismatches. Appending 'Z' before parsing plus
// timeZone: 'UTC' on the formatter treats the string's digits as literal wall-clock values
// everywhere, independent of where it's parsed or rendered.
function parseBackendDateTime(value: string): Date {
  return new Date(value.endsWith('Z') ? value : `${value}Z`)
}

// Different Intl/ICU builds render the space before AM/PM differently (regular space vs.
// U+202F narrow no-break space) — normalized here so output is byte-identical regardless
// of which ICU version formatted it, another common, invisible hydration-mismatch source.
function normalizeSpaces(text: string): string {
  return text.replace(/[ \xa0]/g, ' ')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return normalizeSpaces(
    new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
  )
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return normalizeSpaces(
    parseBackendDateTime(value).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC'
    })
  )
}

// "just now" / "5m ago" / "3h ago" / "2d ago", falling back to formatDate
// beyond ~30 days where a relative count stops being useful — pass the full
// formatDateTime as a title/tooltip alongside it so the exact moment is never lost.
//
// Unlike the formatters above, this has to compare against the real current
// instant, so the zone matters: the backend sends LocalDateTime in its own
// local time with no offset. Parsing that as browser-local time (no 'Z') is
// right whenever the browser and backend share a timezone; appending 'Z'
// made everything within the server's UTC offset (7h here) read "just now".
// A future-dated value (clock skew) also reads "just now" rather than "-3m ago".
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—'
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value)
  const then = new Date(hasZone ? value : value.replace(' ', 'T')).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  const diffSeconds = Math.round(diffMs / 1000)
  if (diffSeconds < 45) return 'just now'
  const diffMinutes = Math.round(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(value)
}

// 'PAST_DUE' / 'past_due' both become 'Past due' — shared by <ColumnValue>'s
// 'enum' column type and any backend enum value shown as plain text.
export function formatEnum(value: string | null | undefined): string {
  if (!value) return '—'
  return humanize(value)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 'dateOfBirth' / 'date_of_birth' both become 'Date of birth' — shared by
// <Field>'s label and <ColumnValue>/<DataTable>'s column header.
export function humanize(name: string): string {
  const words = name
    .replace(/_/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Video lengths: "0:42", "12:05", "1:02:09". Hours only appear when needed,
// matching how video players display time.
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—'
  const whole = Math.round(totalSeconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const seconds = whole % 60
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}` : `${minutes}:${ss}`
}

// Aggregate watch time for stat tiles: "45s", "12m", "3h 20m", "4d 6h".
// Coarser than formatDuration — a total of 200 hours reads better as "8d 8h".
export function formatWatchTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '—'
  const s = Math.round(totalSeconds)
  if (s < 60) return `${s}s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}
