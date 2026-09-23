import { niceCeil } from './ai'

// Helpers for the Analytics pages: period-over-period deltas, date-range
// presets, and rolling daily series up into weeks for long ranges.

export interface DeltaInfo {
  /** e.g. "+12%", "−3%", "New", "No change". */
  text: string
  direction: 'up' | 'down' | 'flat'
}

/** Change of `current` against `previous`, as a whole percentage. */
export function describeDelta(current: number, previous: number): DeltaInfo {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return { text: '—', direction: 'flat' }
  if (previous === 0) return current === 0 ? { text: 'No change', direction: 'flat' } : { text: 'New', direction: 'up' }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const rounded = Math.round(pct)
  if (rounded === 0) return { text: 'No change', direction: 'flat' }
  // "+22110%" is unreadable; past ten-fold growth say how many times over.
  if (pct >= 1000) return { text: `${Math.round(current / previous)}×`, direction: 'up' }
  return { text: `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`, direction: rounded > 0 ? 'up' : 'down' }
}

/** Change between two rates (0–1), in percentage points: "+4 pts". */
export function describeRateDelta(current: number, previous: number): DeltaInfo {
  const points = Math.round((current - previous) * 100)
  if (points === 0) return { text: 'No change', direction: 'flat' }
  return { text: `${points > 0 ? '+' : '−'}${Math.abs(points)} pts`, direction: points > 0 ? 'up' : 'down' }
}

export type RangeKey = '7d' | '30d' | '90d' | '365d' | 'month' | 'prev-month'

export const RANGE_PRESETS: { value: RangeKey; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
  { value: 'month', label: 'This month' },
  { value: 'prev-month', label: 'Last month' }
]

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** [from, to] (inclusive ISO dates) for a preset, relative to `today`. */
export function rangeDates(key: RangeKey, today: Date = new Date()): { from: string; to: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = today.getDate()
  const back = (days: number) => isoDate(new Date(y, m, d - (days - 1)))
  switch (key) {
    case '7d':
      return { from: back(7), to: isoDate(today) }
    case '90d':
      return { from: back(90), to: isoDate(today) }
    case '365d':
      return { from: back(365), to: isoDate(today) }
    case 'month':
      return { from: isoDate(new Date(y, m, 1)), to: isoDate(today) }
    case 'prev-month':
      return { from: isoDate(new Date(y, m - 1, 1)), to: isoDate(new Date(y, m, 0)) }
    default:
      return { from: back(30), to: isoDate(today) }
  }
}

export interface SeriesBucket {
  /** First day of the bucket (ISO). */
  start: string
  /** Last day of the bucket (ISO). */
  end: string
  value: number
}

/**
 * Daily points as chart buckets: one per day up to `maxBars`, otherwise
 * consecutive 7-day groups (the last may be shorter). `sum` adds the days;
 * `last` keeps the final day's value (for running totals).
 */
export function bucketSeries(points: { date: string; value: number }[], mode: 'sum' | 'last' = 'sum', maxBars = 62): SeriesBucket[] {
  if (points.length <= maxBars) return points.map((p) => ({ start: p.date, end: p.date, value: p.value }))
  const out: SeriesBucket[] = []
  for (let i = 0; i < points.length; i += 7) {
    const week = points.slice(i, i + 7)
    out.push({
      start: week[0]!.date,
      end: week[week.length - 1]!.date,
      value: mode === 'last' ? week[week.length - 1]!.value : week.reduce((s, p) => s + p.value, 0)
    })
  }
  return out
}

/** Short date label: "Sep 3". */
export function shortDate(iso: string | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Compact counts: 950, 12.3K, 4.1M. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs < 1000) return String(Math.round(value))
  const fixed = (n: number) => (n.toFixed(1).endsWith('.0') ? n.toFixed(0) : n.toFixed(1))
  if (abs < 1_000_000) return `${fixed(value / 1000)}K`
  return `${fixed(value / 1_000_000)}M`
}

/** Daily points → chart items (weekly buckets for long ranges), with a matching "per day/week" word. */
export function trendItems(points: { date: string; value: number }[], mode: 'sum' | 'last' = 'sum') {
  const buckets = bucketSeries(points, mode)
  const weekly = buckets.length > 0 && buckets[0]!.start !== buckets[0]!.end
  return {
    per: weekly ? 'week' : 'day',
    items: buckets.map((b) => ({
      key: b.start,
      label: shortDate(b.start),
      tooltip: b.start === b.end ? formatDateLong(b.start) : `${shortDate(b.start)} – ${shortDate(b.end)}`,
      value: b.value
    }))
  }
}

function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// Axis tops that are round in the unit people read. niceCeil works in the raw
// number, which for bytes (1024-based) or seconds gives "18.6 GB" / "5d 18h".
export function niceBytesTop(max: number): number {
  if (!(max > 0)) return 1024
  const unit = 1024 ** Math.max(0, Math.floor(Math.log(max) / Math.log(1024)))
  return niceCeil(max / unit) * unit
}

export function niceSecondsTop(max: number): number {
  if (!(max > 0)) return 60
  const unit = max < 3600 ? 60 : max < 2 * 86_400 ? 3600 : 86_400
  return niceCeil(max / unit) * unit
}
