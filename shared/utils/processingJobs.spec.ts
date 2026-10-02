import { describe, expect, it } from 'vitest'
import { formatJobParameters, isActiveJobStatus, JOB_STATUSES, JOB_TYPES, jobTypeMeta, logsToText } from './processingJobs'
import { humanize } from './format'

Object.assign(globalThis, { humanize })

describe('isActiveJobStatus', () => {
  it('treats queued and running as active', () => {
    expect(isActiveJobStatus('QUEUED')).toBe(true)
    expect(isActiveJobStatus('RUNNING')).toBe(true)
  })

  it('treats finished states as settled', () => {
    expect(isActiveJobStatus('SUCCEEDED')).toBe(false)
    expect(isActiveJobStatus('FAILED')).toBe(false)
    expect(isActiveJobStatus('CANCELLED')).toBe(false)
  })
})

describe('jobTypeMeta', () => {
  it('labels known types', () => {
    expect(jobTypeMeta('GENERATE_SUBTITLES').label).toBe('Generate subtitles')
  })

  it('falls back to a humanized label for a type the UI does not know yet', () => {
    expect(jobTypeMeta('DETECT_SCENES')).toMatchObject({ label: 'Detect scenes', icon: 'i-lucide-cog' })
    expect(jobTypeMeta('DETECT_SCENES').tone).toBeTruthy()
  })
})

describe('formatJobParameters', () => {
  it('pretty-prints JSON', () => {
    expect(formatJobParameters('{"targetLanguage":"en"}')).toBe('{\n  "targetLanguage": "en"\n}')
  })

  it('returns null for empty input', () => {
    expect(formatJobParameters(null)).toBeNull()
    expect(formatJobParameters('   ')).toBeNull()
  })

  it('shows invalid JSON as-is instead of hiding it', () => {
    expect(formatJobParameters('lang=en')).toBe('lang=en')
  })
})

describe('logsToText', () => {
  it('formats one aligned line per entry', () => {
    const text = logsToText([
      { level: 'INFO', message: 'Started', createdAt: '2026-09-23T12:00:01.123456' },
      { level: 'ERROR', message: 'Boom', createdAt: '2026-09-23T12:00:02' }
    ])
    expect(text).toBe('2026-09-23 12:00:01 INFO  Started\n2026-09-23 12:00:02 ERROR Boom')
  })
})

describe('job colours', () => {
  it('give every status a tile tone and every type its own colour', () => {
    for (const s of JOB_STATUSES) {
      expect(s.tone.edge, s.value).toBeTruthy()
      expect(s.tone.count, s.value).toBeTruthy()
      expect(s.tone.active, s.value).toBeTruthy()
    }
    expect(new Set(JOB_TYPES.map((t) => t.tone)).size).toBe(JOB_TYPES.length)
  })
})
