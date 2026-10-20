import { describe, expect, it } from 'vitest'
import { cuesToSrt, editedCues, editedTime, pauseCrossed, rampedAt, rampedHolds, resultLength, speedAt, type TrimTiming } from './editTiming'

const plain: TrimTiming = { startMs: 10_000, endMs: 20_000, speeds: [], holds: [], introMs: 0, outroMs: 0 }

describe('editedTime', () => {
  it('moves moments back by the trim start and drops ones outside it', () => {
    expect(editedTime(15_000, plain)).toBe(5000)
    expect(editedTime(9000, plain)).toBeNull()
    expect(editedTime(21_000, plain)).toBeNull()
  })

  it('follows the speed parts, the pauses and the intro card, like the server', () => {
    const t: TrimTiming = {
      startMs: 0,
      endMs: 20_000,
      speeds: [{ startMs: 2000, endMs: 6000, speed: 2 }],
      holds: [{ atMs: 8000, durationMs: 1000 }],
      introMs: 3000,
      outroMs: 0
    }
    expect(editedTime(1000, t)).toBe(4000)
    expect(editedTime(6000, t)).toBe(7000)
    // 10 s ramps to 8 s, after the pause at (ramped) 6 s, after the card.
    expect(editedTime(10_000, t)).toBe(12_000)
  })

  it('keeps a line ending at a pause up through it', () => {
    const t = { ...plain, startMs: 0, holds: [{ atMs: 4000, durationMs: 2000 }] }
    expect(editedTime(4000, t, 'before')).toBe(4000)
    expect(editedTime(4000, t, 'after')).toBe(6000)
  })
})

describe('rampedAt and rampedHolds', () => {
  it('shortens a fast part and lengthens a slow one', () => {
    expect(rampedAt(5000, [{ startMs: 0, endMs: 4000, speed: 2 }])).toBe(3000)
    expect(rampedAt(2000, [{ startMs: 0, endMs: 2000, speed: 0.5 }])).toBe(4000)
  })
  it('drops a hold within 0.5 s of the one before', () => {
    expect(
      rampedHolds({
        speeds: [],
        holds: [
          { atMs: 2000, durationMs: 1000 },
          { atMs: 2300, durationMs: 1000 },
          { atMs: 4000, durationMs: 500 }
        ]
      })
    ).toEqual([
      { atMs: 2000, durationMs: 1000 },
      { atMs: 4000, durationMs: 500 }
    ])
  })
})

describe('resultLength', () => {
  it('adds the pauses and both cards', () => {
    expect(resultLength({ ...plain, holds: [{ atMs: 2000, durationMs: 1000 }], introMs: 2000, outroMs: 3000 })).toBe(16_000)
  })
})

describe('editedCues and cuesToSrt', () => {
  it('cuts the lines to the trim and writes an .srt', () => {
    const cues = editedCues(
      [
        { startMs: 9000, endMs: 11_000, text: ' Hello ' },
        { startMs: 12_000, endMs: 14_000, text: 'World' },
        { startMs: 30_000, endMs: 31_000, text: 'Later' }
      ],
      { ...plain, introMs: 2000 }
    )
    expect(cues).toEqual([
      { startMs: 2000, endMs: 3000, text: 'Hello' },
      { startMs: 4000, endMs: 6000, text: 'World' }
    ])
    expect(cuesToSrt(cues)).toBe('1\n00:00:02,000 --> 00:00:03,000\nHello\n\n2\n00:00:04,000 --> 00:00:06,000\nWorld\n')
  })
})

describe('preview timing', () => {
  it('plays each speed part at its speed', () => {
    const parts = [{ startMs: 1000, endMs: 2000, speed: 0.5 }]
    expect(speedAt(parts, 1500)).toBe(0.5)
    expect(speedAt(parts, 2000)).toBe(1)
  })
  it('notices a pause played past, but not one jumped over', () => {
    const holds = [{ atMs: 3000, durationMs: 1000 }]
    expect(pauseCrossed(holds, 2900, 3100)).toEqual(holds[0])
    expect(pauseCrossed(holds, 1000, 5000)).toBeNull()
    expect(pauseCrossed(holds, 3100, 3200)).toBeNull()
  })
})
