import { describe, expect, it } from 'vitest'
import {
  ACTIVE_MIN_SECONDS,
  addActivity,
  fromCompact,
  mergeLogs,
  sameLog,
  toCompact,
  CARD_SECONDS,
  currentStreak,
  dateKey,
  goalFraction,
  isActiveDay,
  lastDays,
  longestStreak,
  parseLog,
  pruneLog,
  shiftDay,
  studySeconds,
  type ActivityLog
} from './studyActivity'

const day = (watchSeconds: number, cards = 0) => ({ watchSeconds, cards })

describe('dateKey / shiftDay', () => {
  it('makes a sortable local day key', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
  it('moves across month and year ends', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29')
    expect(shiftDay('2026-05-10', 0)).toBe('2026-05-10')
  })
})

describe('studySeconds / isActiveDay', () => {
  it('counts a reviewed card as half a minute', () => {
    expect(studySeconds(day(60, 2))).toBe(60 + 2 * CARD_SECONDS)
    expect(studySeconds(undefined)).toBe(0)
  })
  it('is active from a minute of study, from watching or from cards', () => {
    expect(isActiveDay(day(ACTIVE_MIN_SECONDS - 1))).toBe(false)
    expect(isActiveDay(day(ACTIVE_MIN_SECONDS))).toBe(true)
    expect(isActiveDay(day(0, 2))).toBe(true)
    expect(isActiveDay(day(0, 1))).toBe(false)
  })
})

describe('addActivity', () => {
  it('adds to a day, creating it, without touching the input', () => {
    const log: ActivityLog = { '2026-05-10': day(30) }
    const next = addActivity(log, '2026-05-10', { watchSeconds: 20, cards: 1 })
    expect(next['2026-05-10']).toEqual(day(50, 1))
    expect(log['2026-05-10']).toEqual(day(30))
    expect(addActivity({}, '2026-05-11', { cards: 2 })['2026-05-11']).toEqual(day(0, 2))
  })
  it('ignores negative amounts', () => {
    expect(addActivity({}, '2026-05-10', { watchSeconds: -5, cards: -1 })['2026-05-10']).toEqual(day(0, 0))
  })
})

describe('currentStreak', () => {
  const log: ActivityLog = { '2026-05-08': day(120), '2026-05-09': day(120), '2026-05-10': day(120) }
  it('counts back from today', () => {
    expect(currentStreak(log, '2026-05-10')).toBe(3)
  })
  it('keeps yesterday’s streak while today is not done yet', () => {
    expect(currentStreak(log, '2026-05-11')).toBe(3)
  })
  it('is broken by a missed day', () => {
    expect(currentStreak(log, '2026-05-12')).toBe(0)
    expect(currentStreak({ ...log, '2026-05-09': day(10) }, '2026-05-10')).toBe(1)
  })
  it('is zero for an empty log, and a day under a minute does not count', () => {
    expect(currentStreak({}, '2026-05-10')).toBe(0)
    expect(currentStreak({ '2026-05-10': day(30) }, '2026-05-10')).toBe(0)
  })
  it('runs across a month end', () => {
    const l: ActivityLog = { '2026-04-30': day(90), '2026-05-01': day(90) }
    expect(currentStreak(l, '2026-05-01')).toBe(2)
  })
})

describe('longestStreak', () => {
  it('finds the longest run, not the latest', () => {
    const log: ActivityLog = {
      '2026-05-01': day(90),
      '2026-05-02': day(90),
      '2026-05-03': day(90),
      '2026-05-05': day(90),
      '2026-05-06': day(90)
    }
    expect(longestStreak(log)).toBe(3)
  })
  it('skips inactive days and handles an empty log', () => {
    expect(longestStreak({})).toBe(0)
    expect(longestStreak({ '2026-05-01': day(5), '2026-05-02': day(90) })).toBe(1)
  })
})

describe('lastDays', () => {
  it('lists the last n days ending today, oldest first', () => {
    const out = lastDays({ '2026-05-10': day(600), '2026-05-08': day(30) }, '2026-05-10', 3)
    expect(out.map((d) => d.key)).toEqual(['2026-05-08', '2026-05-09', '2026-05-10'])
    expect(out.map((d) => d.seconds)).toEqual([30, 0, 600])
    expect(out.map((d) => d.active)).toEqual([false, false, true])
  })
})

describe('goalFraction', () => {
  it('is the share of the goal done, capped at 1', () => {
    expect(goalFraction(300, 10)).toBe(0.5)
    expect(goalFraction(1200, 10)).toBe(1)
    expect(goalFraction(0, 10)).toBe(0)
  })
  it('is 0 without a goal', () => {
    expect(goalFraction(100, 0)).toBe(0)
  })
})

describe('pruneLog', () => {
  it('drops days older than the limit', () => {
    const log: ActivityLog = { '2026-05-10': day(60), '2025-01-01': day(60) }
    expect(Object.keys(pruneLog(log, '2026-05-10', 400))).toEqual(['2026-05-10'])
  })
})

describe('parseLog', () => {
  it('reads what it wrote', () => {
    const log: ActivityLog = { '2026-05-10': day(75.5, 3) }
    expect(parseLog(JSON.stringify(log))).toEqual(log)
  })
  it('gives an empty log for nothing, junk, or the wrong shape', () => {
    expect(parseLog(null)).toEqual({})
    expect(parseLog('not json')).toEqual({})
    expect(parseLog('[1,2]')).toEqual({})
    expect(parseLog('null')).toEqual({})
  })
  it('drops bad days and clamps negatives', () => {
    const raw = JSON.stringify({ '2026-05-10': { watchSeconds: -5, cards: 2 }, tomorrow: { watchSeconds: 1, cards: 1 }, '2026-05-11': { watchSeconds: 'x', cards: 1 } })
    expect(parseLog(raw)).toEqual({ '2026-05-10': { watchSeconds: 0, cards: 2 } })
  })
})

describe('compact form', () => {
  it('round-trips a log, in whole seconds', () => {
    const log: ActivityLog = { '2026-05-10': day(75.4, 3), '2026-05-11': day(0, 1) }
    expect(toCompact(log)).toEqual({ '2026-05-10': [75, 3], '2026-05-11': [0, 1] })
    expect(fromCompact(toCompact(log))).toEqual({ '2026-05-10': day(75, 3), '2026-05-11': day(0, 1) })
  })
  it('drops what is not the expected shape', () => {
    expect(fromCompact(null)).toEqual({})
    expect(fromCompact([1, 2])).toEqual({})
    expect(fromCompact('x')).toEqual({})
    expect(fromCompact({ today: [1, 1], '2026-05-10': [1], '2026-05-11': ['a', 1], '2026-05-12': [-5, 2] })).toEqual({ '2026-05-12': day(0, 2) })
  })
})

describe('mergeLogs', () => {
  it('keeps days from both sides', () => {
    expect(mergeLogs({ '2026-05-10': day(60) }, { '2026-05-11': day(30, 1) })).toEqual({ '2026-05-10': day(60), '2026-05-11': day(30, 1) })
  })
  it('takes the larger figure for a day in both, not the sum', () => {
    expect(mergeLogs({ '2026-05-10': day(60, 5) }, { '2026-05-10': day(90, 2) })).toEqual({ '2026-05-10': day(90, 5) })
  })
  it('does not change its inputs, and merging twice changes nothing', () => {
    const a: ActivityLog = { '2026-05-10': day(60) }
    const b: ActivityLog = { '2026-05-10': day(90) }
    const once = mergeLogs(a, b)
    expect(a['2026-05-10']).toEqual(day(60))
    expect(mergeLogs(once, b)).toEqual(once)
  })
  it('can rebuild a streak from two devices that each saw part of it', () => {
    const merged = mergeLogs({ '2026-05-09': day(120), '2026-05-10': day(120) }, { '2026-05-08': day(120), '2026-05-10': day(120) })
    expect(currentStreak(merged, '2026-05-10')).toBe(3)
  })
})

describe('sameLog', () => {
  it('compares the figures', () => {
    expect(sameLog({ '2026-05-10': day(60.2, 1) }, { '2026-05-10': day(60, 1) })).toBe(true)
    expect(sameLog({ '2026-05-10': day(60) }, { '2026-05-10': day(61) })).toBe(false)
    expect(sameLog({ '2026-05-10': day(60) }, {})).toBe(false)
    expect(sameLog({}, {})).toBe(true)
  })
})
