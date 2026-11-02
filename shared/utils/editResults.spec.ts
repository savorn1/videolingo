import { describe, expect, it } from 'vitest'
import { EXPIRES_SOON_MS, clipLabel, expiresSoon, promotableAsNew } from './editResults'

describe('clipLabel', () => {
  it('shows the name of a split part', () => {
    expect(clipLabel({ operation: 'SPLIT', segmentIndex: 1, startMs: 5000, endMs: null, label: 'Practice' })).toBe('Segment 2 · Practice · 0:05 – end')
  })
  it('names each kind of result', () => {
    expect(clipLabel({ operation: 'TRIM', segmentIndex: null, startMs: 5000, endMs: 30_000 })).toBe('Trim · 0:05 – 0:30')
    expect(clipLabel({ operation: 'SPLIT', segmentIndex: 1, startMs: 60_000, endMs: null })).toBe('Segment 2 · 1:00 – end')
    expect(clipLabel({ operation: 'AUDIO', segmentIndex: null, startMs: 0, endMs: null })).toBe('Video with new audio')
  })
})

describe('promotableAsNew', () => {
  it('leaves out sound files and results of videos in the trash', () => {
    const row = (operation: 'TRIM' | 'EXTRACT', videoDeleted = false) => ({ videoDeleted, clip: { operation } })
    expect(promotableAsNew([row('TRIM'), row('EXTRACT'), row('TRIM', true)])).toHaveLength(1)
  })
})

describe('expiresSoon', () => {
  const now = Date.parse('2026-10-31T12:00:00Z')
  const at = (ms: number) => new Date(now + ms).toISOString()
  it('flags results within the last hours, or already past', () => {
    expect(expiresSoon(at(EXPIRES_SOON_MS - 60_000), now)).toBe(true)
    expect(expiresSoon(at(-60_000), now)).toBe(true)
  })
  it('leaves the rest alone, and unknown times', () => {
    expect(expiresSoon(at(EXPIRES_SOON_MS + 60_000), now)).toBe(false)
    expect(expiresSoon(at(3 * 24 * 3600_000), now)).toBe(false)
    expect(expiresSoon(null, now)).toBe(false)
    expect(expiresSoon('not a date', now)).toBe(false)
  })
})
