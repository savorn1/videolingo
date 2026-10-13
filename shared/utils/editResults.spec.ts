import { describe, expect, it } from 'vitest'
import { clipLabel, promotableAsNew } from './editResults'

describe('clipLabel', () => {
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
