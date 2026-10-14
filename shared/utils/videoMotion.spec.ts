import { describe, expect, it } from 'vitest'
import {
  describeMotion,
  isPlainMotion,
  MAX_HOLDS,
  motionProblem,
  motionRequest,
  PLAIN_MOTION,
  nextSpeedPart,
  sanitizeMotion,
  sentencePauses
} from './videoMotion'

const m = (patch: Partial<typeof PLAIN_MOTION>) => ({ ...PLAIN_MOTION, ...patch })

describe('motionProblem', () => {
  it('accepts plain settings and sensible ones', () => {
    expect(motionProblem(PLAIN_MOTION, 10_000)).toBeNull()
    expect(motionProblem(m({ freeze: { atMs: 2000, durationMs: 1500 }, speeds: [{ startMs: 0, endMs: 3000, speed: 0.5 }], reverse: true }), 10_000)).toBeNull()
  })
  it('checks fades, freeze and speed against the clip', () => {
    expect(motionProblem(m({ fadeInMs: 6000 }), 10_000)).toMatch(/between 0 and 5 s/)
    expect(motionProblem(m({ fadeInMs: 3000, fadeOutMs: 3000 }), 5000)).toMatch(/longer than the clip/)
    expect(motionProblem(m({ freeze: { atMs: 0, durationMs: 1000 } }), 10_000)).toMatch(/after the start/)
    expect(motionProblem(m({ freeze: { atMs: 12_000, durationMs: 1000 } }), 10_000)).toMatch(/before the end/)
    expect(motionProblem(m({ speeds: [{ startMs: 0, endMs: 3000, speed: 3 }] }), 10_000)).toMatch(/pick a speed/)
    expect(motionProblem(m({ speeds: [{ startMs: 1000, endMs: 1200, speed: 2 }] }), 10_000)).toMatch(/at least 0.5 s/)
  })
  it('allows backwards only on short clips, and checks the zoom and green screen', () => {
    expect(motionProblem(m({ reverse: true }), 90_000)).toMatch(/up to 60 s/)
    expect(motionProblem(m({ zoomTo: { cx: 0.5, cy: 0.5, size: 0.1 } }), 10_000)).toMatch(/25% and 95%/)
    expect(motionProblem(m({ greenScreen: { keyColor: '#00ff00', similarity: 0.9, background: '#000000' } }), 10_000)).toMatch(/tolerance/)
    expect(motionProblem(m({ greenScreen: { keyColor: 'green', similarity: 0.3, background: '#000000' } }), 10_000)).toMatch(/colours/)
  })
})

describe('motionRequest and describeMotion', () => {
  it('sends only what is in use', () => {
    expect(motionRequest(PLAIN_MOTION)).toEqual({})
    expect(motionRequest(m({ effect: 'ZOOM_IN', fadeOutMs: 1000, reverse: true }))).toEqual({
      effect: 'ZOOM_IN',
      fade: { inMs: 0, outMs: 1000, color: 'BLACK' },
      reverse: true
    })
    expect(isPlainMotion(PLAIN_MOTION)).toBe(true)
    expect(isPlainMotion(m({ stabilize: true }))).toBe(false)
  })
  it('says what it does', () => {
    expect(describeMotion(m({ effect: 'ZOOM_IN', freeze: { atMs: 1000, durationMs: 2000 }, reverse: true }))).toBe('slow zoom in, frame held 2 s, backwards')
    expect(describeMotion(PLAIN_MOTION)).toBeNull()
  })
  it('reads drafts from before, filling in what they lack', () => {
    expect(sanitizeMotion(undefined)).toEqual(PLAIN_MOTION)
    expect(sanitizeMotion({ reverse: true })).toEqual({ ...PLAIN_MOTION, reverse: true })
  })
})

describe('pauses after each sentence', () => {
  const sentences = [{ endMs: 3000 }, { endMs: 6000 }, { endMs: 6200 }, { endMs: 9800 }, { endMs: 15_000 }]

  it('puts a pause at each sentence end inside the range, on the clip time', () => {
    expect(sentencePauses(sentences, 1000, 10_000, 1500)).toEqual([
      { atMs: 2000, durationMs: 1500 },
      { atMs: 5000, durationMs: 1500 }
    ])
  })

  it('skips the very end and caps the count', () => {
    expect(sentencePauses([{ endMs: 9900 }], 0, 10_000, 1000)).toEqual([])
    const many = Array.from({ length: 100 }, (_, i) => ({ endMs: (i + 1) * 1000 }))
    expect(sentencePauses(many, 0, 200_000, 1000)).toHaveLength(MAX_HOLDS)
  })

  it('checks, sends, describes and restores them', () => {
    const holds = sentencePauses(sentences, 0, 10_000, 1000)
    expect(motionProblem(m({ holds }), 10_000)).toBeNull()
    expect(
      motionProblem(
        m({
          holds: [
            { atMs: 2000, durationMs: 1000 },
            { atMs: 2200, durationMs: 1000 }
          ]
        }),
        10_000
      )
    ).toMatch(/0.5 s apart/)
    expect(motionProblem(m({ holds: [{ atMs: 2000, durationMs: 100 }] }), 10_000)).toMatch(/between 0.5/)
    expect(motionRequest(m({ holds })).holds).toHaveLength(2)
    expect(motionRequest(m({})).holds).toBeUndefined()
    expect(describeMotion(m({ holds }))).toBe('2 pauses')
    expect(isPlainMotion(m({ holds }))).toBe(false)
    expect(sanitizeMotion({ effect: 'GLITCH' }).holds).toEqual([])
  })
})

describe('several parts at another speed', () => {
  const slow = { startMs: 1000, endMs: 3000, speed: 0.5 }
  const fast = { startMs: 5000, endMs: 7000, speed: 2 }

  it('checks them together: no overlaps, each valid', () => {
    expect(motionProblem(m({ speeds: [fast, slow] }), 10_000)).toBeNull()
    expect(motionProblem(m({ speeds: [slow, { startMs: 2500, endMs: 4000, speed: 2 }] }), 10_000)).toMatch(/overlap/)
    expect(motionProblem(m({ speeds: [slow, { startMs: 4000, endMs: 4100, speed: 2 }] }), 10_000)).toMatch(/^Speed part 2: .*0.5 s/)
  })

  it('sends them in time order and describes them', () => {
    expect(motionRequest(m({ speeds: [fast, slow] })).speeds).toEqual([slow, fast])
    expect(describeMotion(m({ speeds: [fast, slow] }))).toBe('2 parts at another speed')
    expect(describeMotion(m({ speeds: [slow] }))).toBe('slow motion 0.5× for 2 s')
  })

  it("turns an older draft's single part into the list", () => {
    expect(sanitizeMotion({ speed: slow }).speeds).toEqual([slow])
    expect(sanitizeMotion({ speed: null }).speeds).toEqual([])
    expect('speed' in sanitizeMotion({ speed: slow })).toBe(false)
  })

  it('places a new part at the first free stretch from the playhead', () => {
    expect(nextSpeedPart([], 4000, 10_000)).toEqual({ startMs: 4000, endMs: 6000, speed: 0.5 })
    expect(nextSpeedPart([slow], 2000, 10_000)).toEqual({ startMs: 3000, endMs: 5000, speed: 0.5 })
    expect(nextSpeedPart([slow, fast], 2000, 10_000)).toEqual({ startMs: 3000, endMs: 5000, speed: 0.5 })
    expect(nextSpeedPart([slow, fast], 6000, 10_000)).toEqual({ startMs: 7000, endMs: 9000, speed: 0.5 })
    expect(nextSpeedPart([], 9800, 10_000)).toBeNull()
  })
})
