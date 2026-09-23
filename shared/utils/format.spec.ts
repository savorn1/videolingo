import { describe, expect, it } from 'vitest'
import { formatDuration, formatRelativeTime, formatWatchTime } from './format'

describe('formatDuration', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatDuration(42)).toBe('0:42')
    expect(formatDuration(725)).toBe('12:05')
  })

  it('adds hours only when needed', () => {
    expect(formatDuration(3729)).toBe('1:02:09')
    expect(formatDuration(3600)).toBe('1:00:00')
  })

  it('rounds fractional seconds', () => {
    expect(formatDuration(59.6)).toBe('1:00')
  })

  it('renders an em dash for missing or invalid values', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(-5)).toBe('—')
    expect(formatDuration(Number.NaN)).toBe('—')
  })

  it('treats zero as a real length', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
})

describe('formatWatchTime', () => {
  it('picks the coarsest sensible unit', () => {
    expect(formatWatchTime(45)).toBe('45s')
    expect(formatWatchTime(720)).toBe('12m')
    expect(formatWatchTime(12000)).toBe('3h 20m')
    expect(formatWatchTime(7200)).toBe('2h')
    expect(formatWatchTime(367200)).toBe('4d 6h')
    expect(formatWatchTime(172800)).toBe('2d')
  })

  it('renders an em dash for missing values', () => {
    expect(formatWatchTime(null)).toBe('—')
  })
})

// Backend LocalDateTime strings carry no offset: "2026-09-23T12:51:00.123".
function localBackendString(msAgo: number): string {
  const d = new Date(Date.now() - msAgo)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.123`
}

describe('formatRelativeTime', () => {
  it('reads backend local timestamps in the local zone, whatever that zone is', () => {
    expect(formatRelativeTime(localBackendString(10 * 1000))).toBe('just now')
    expect(formatRelativeTime(localBackendString(5 * 60 * 1000))).toBe('5m ago')
    expect(formatRelativeTime(localBackendString(2 * 3600 * 1000))).toBe('2h ago')
    expect(formatRelativeTime(localBackendString(3 * 86400 * 1000))).toBe('3d ago')
  })

  it('honours an explicit offset when one is present', () => {
    expect(formatRelativeTime(new Date(Date.now() - 2 * 3600 * 1000).toISOString())).toBe('2h ago')
  })

  it('shows future timestamps (clock skew) as just now', () => {
    expect(formatRelativeTime(localBackendString(-60 * 1000))).toBe('just now')
  })

  it('handles missing or unparseable values', () => {
    expect(formatRelativeTime(null)).toBe('—')
    expect(formatRelativeTime('not a date')).toBe('—')
  })
})
