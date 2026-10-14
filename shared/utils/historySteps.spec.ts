import { describe, expect, it } from 'vitest'
import { jumpTo, createHistory, record } from './history'
import { describeStep, historySteps } from './historySteps'

const base = {
  trim: { range: [0, 10_000], cropOn: false, crop: { x: 0, y: 0, w: 0, h: 0 }, look: { contrast: 1 }, cuts: [] },
  split: [{ startMsSeconds: 0, endMsSeconds: null }],
  audio: { volume: 1, fadeOutMs: 0, music: null },
  overlay: [],
  captions: null,
  join: { clips: [] }
}
const s = (patch: (x: typeof base) => void) => {
  const x = JSON.parse(JSON.stringify(base)) as typeof base
  patch(x)
  return JSON.stringify(x)
}

describe('describeStep', () => {
  it('names what changed', () => {
    expect(
      describeStep(
        s(() => {}),
        s((x) => (x.trim.range = [1000, 10_000]))
      )
    ).toBe('Trim range')
    expect(
      describeStep(
        s(() => {}),
        s((x) => ((x.trim.cropOn = true), (x.trim.crop = { x: 1, y: 1, w: 10, h: 10 })))
      )
    ).toBe('Crop')
    expect(
      describeStep(
        s(() => {}),
        s((x) => ((x.audio.volume = 2), (x.audio.fadeOutMs = 1000)))
      )
    ).toBe('Sound: volume, fade out')
    expect(
      describeStep(
        s(() => {}),
        s((x) => (x.overlay = [{ id: 'a' }] as never))
      )
    ).toBe('Added a layer')
    expect(
      describeStep(
        s((x) => (x.overlay = [{ id: 'a' }, { id: 'b' }] as never)),
        s(() => {})
      )
    ).toBe('Removed 2 layers')
  })
  it('sums up a step that changed many things', () => {
    const after = s((x) => {
      x.trim.range = [1, 2]
      x.trim.look = { contrast: 2 }
      x.captions = { style: 'BOX' } as never
    })
    expect(
      describeStep(
        s(() => {}),
        after
      )
    ).toBe('Trim range · Look +1')
  })
  it('falls back to "Change"', () => {
    expect(describeStep('{}', '{}')).toBe('Change')
    expect(describeStep('not json', '{}')).toBe('Change')
  })
})

describe('historySteps and jumpTo', () => {
  it('names every step and jumps to any', () => {
    let h = createHistory(s(() => {}))
    h = record(
      h,
      s((x) => (x.trim.range = [1000, 10_000]))
    )
    h = record(
      h,
      s((x) => ((x.trim.range = [1000, 10_000]), (x.audio.volume = 2)))
    )
    expect(historySteps(h.entries)).toEqual(['Start', 'Trim range', 'Sound: volume'])
    expect(jumpTo(h, 0).index).toBe(0)
    expect(jumpTo(h, 9).index).toBe(2)
  })
})
