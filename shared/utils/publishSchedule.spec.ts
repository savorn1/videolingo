import { describe, expect, it } from 'vitest'
import { fromDateTimeLocal, schedulePresets, scheduleProblem, scheduleSeries, toDateTimeLocal, videoStatusBadge } from './publishSchedule'

describe('videoStatusBadge', () => {
  it('says enabled, scheduled with when, or disabled', () => {
    expect(videoStatusBadge({ enabled: true, publishAt: '2026-10-10T09:00:00' })).toEqual({ label: 'Enabled', color: 'success' })
    expect(videoStatusBadge({ enabled: false, publishAt: '2026-10-10T09:00:00' })).toEqual({ label: 'Scheduled · Oct 10, 2026, 9:00 AM', color: 'info' })
    expect(videoStatusBadge({ enabled: false, publishAt: null })).toEqual({ label: 'Disabled', color: 'warning' })
  })
})

describe('datetime-local values', () => {
  it('go both ways in the browser’s time', () => {
    const d = new Date(2026, 9, 10, 9, 5)
    expect(toDateTimeLocal(d)).toBe('2026-10-10T09:05')
    expect(fromDateTimeLocal('2026-10-10T09:05')?.getTime()).toBe(d.getTime())
    expect(fromDateTimeLocal('')).toBeNull()
    expect(fromDateTimeLocal('tomorrow')).toBeNull()
  })
})

describe('schedulePresets', () => {
  it('offers the next quarter hour after an hour, tomorrow and next Monday at 9:00', () => {
    // Thursday 8 October 2026, 14:07
    const [hour, tomorrow, monday] = schedulePresets(new Date(2026, 9, 8, 14, 7))
    expect(toDateTimeLocal(hour!.at)).toBe('2026-10-08T15:15')
    expect(toDateTimeLocal(tomorrow!.at)).toBe('2026-10-09T09:00')
    expect(toDateTimeLocal(monday!.at)).toBe('2026-10-12T09:00')
  })
  it('takes the Monday after next when today is Monday', () => {
    expect(toDateTimeLocal(schedulePresets(new Date(2026, 9, 12, 10, 0))[2]!.at)).toBe('2026-10-19T09:00')
  })
})

describe('scheduleProblem', () => {
  const now = new Date(2026, 9, 8, 12, 0)
  it('accepts from a moment ago to a year ahead', () => {
    expect(scheduleProblem(new Date(2026, 9, 8, 13, 0), now)).toBeNull()
    expect(scheduleProblem(new Date(2026, 9, 8, 11, 59), now)).toBeNull()
  })
  it('refuses nothing chosen, the past and too far ahead', () => {
    expect(scheduleProblem(null, now)).toMatch(/Choose a date/)
    expect(scheduleProblem(new Date(2026, 9, 8, 11, 0), now)).toMatch(/future/)
    expect(scheduleProblem(new Date(2027, 11, 1), now)).toMatch(/year/)
  })
})

describe('scheduleSeries', () => {
  const now = new Date(2026, 9, 13, 12, 0)
  const start = new Date(2026, 9, 14, 9, 0)
  const day = 24 * 60 * 60 * 1000
  it('spaces the disabled videos out from the start, skipping enabled ones and the trash', () => {
    const plan = scheduleSeries([{ enabled: false }, { enabled: true }, { enabled: false, deleted: true }, { enabled: false }], start, day, now)
    expect(plan.map((p) => (p.at ? toDateTimeLocal(p.at) : p.skipped))).toEqual(['2026-10-14T09:00', 'already enabled', 'in the trash', '2026-10-15T09:00'])
  })
  it('leaves out times further ahead than the server accepts', () => {
    const plan = scheduleSeries([{ enabled: false }, { enabled: false }], new Date(2027, 9, 10), 7 * day, now)
    expect(plan[0]!.at).not.toBeNull()
    expect(plan[1]!.skipped).toMatch(/year/)
  })
})
