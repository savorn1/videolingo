import { describe, expect, it } from 'vitest'
import { activeJobs, jobsLabel, nextPollDelay } from './jobsIndicator'

describe('activeJobs', () => {
  it('adds running and waiting jobs', () => {
    expect(activeJobs({ RUNNING: 2, QUEUED: 3 })).toEqual({ running: 2, waiting: 3, total: 5 })
  })
  it('copes with missing or odd counts', () => {
    expect(activeJobs(null)).toEqual({ running: 0, waiting: 0, total: 0 })
    expect(activeJobs({})).toEqual({ running: 0, waiting: 0, total: 0 })
    expect(activeJobs({ RUNNING: -4, QUEUED: 1 })).toEqual({ running: 0, waiting: 1, total: 1 })
  })
})

describe('jobsLabel', () => {
  it('says what is running and what is waiting', () => {
    expect(jobsLabel({ RUNNING: 2, QUEUED: 3 })).toBe('2 jobs running, 3 waiting')
    expect(jobsLabel({ RUNNING: 1, QUEUED: 1 })).toBe('1 job running, 1 waiting')
  })
  it('leaves out what is zero', () => {
    expect(jobsLabel({ RUNNING: 1 })).toBe('1 job running')
    expect(jobsLabel({ QUEUED: 4 })).toBe('4 jobs waiting')
    expect(jobsLabel({ QUEUED: 1 })).toBe('1 job waiting')
    expect(jobsLabel({})).toBe('')
  })
})

describe('nextPollDelay', () => {
  it('looks often while jobs are active and seldom otherwise', () => {
    expect(nextPollDelay(3, false)).toBe(5000)
    expect(nextPollDelay(0, false)).toBe(20_000)
  })
  it('stops while the tab is hidden', () => {
    expect(nextPollDelay(3, true)).toBeNull()
    expect(nextPollDelay(0, true)).toBeNull()
  })
})
