import { describe, expect, it } from 'vitest'
import { activeJobs, endedJobsMessage, jobsLabel, nextPollDelay, withJobCount } from './jobsIndicator'

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
    expect(nextPollDelay(3, true)).toBe(30_000)
    expect(nextPollDelay(0, true)).toBeNull()
  })
})

describe('withJobCount', () => {
  it('puts the count in front only while jobs are active', () => {
    expect(withJobCount('Videos · VideoLingo', 2)).toBe('(2) Videos · VideoLingo')
    expect(withJobCount('Videos · VideoLingo', 0)).toBe('Videos · VideoLingo')
  })
})

describe('endedJobsMessage', () => {
  const job = { id: 9, status: 'SUCCEEDED', typeLabel: 'Translate', videoTitle: 'Lesson 4', errorMessage: null }
  it('names one job, the video, and where to open it', () => {
    expect(endedJobsMessage([job])).toEqual({ title: 'Translate finished', description: 'Lesson 4', color: 'success', to: '/processing-jobs/9' })
  })
  it('says why one failed', () => {
    expect(endedJobsMessage([{ ...job, status: 'FAILED', errorMessage: 'No transcript' }])).toMatchObject({
      title: 'Translate failed',
      description: 'Lesson 4: No transcript',
      color: 'error'
    })
    expect(endedJobsMessage([{ ...job, status: 'CANCELLED' }])).toMatchObject({ title: 'Translate cancelled', color: 'neutral' })
  })
  it('counts several, pointing at the list', () => {
    expect(endedJobsMessage([job, { ...job, id: 10 }, { ...job, id: 11, status: 'FAILED' }])).toEqual({
      title: '3 jobs ended: 2 finished, 1 failed',
      color: 'error',
      to: '/processing-jobs'
    })
    expect(endedJobsMessage([])).toBeNull()
  })
})
