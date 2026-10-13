import { describe, expect, it } from 'vitest'
import { describeMotion, isPlainMotion, motionProblem, motionRequest, PLAIN_MOTION, sanitizeMotion } from './videoMotion'

const m = (patch: Partial<typeof PLAIN_MOTION>) => ({ ...PLAIN_MOTION, ...patch })

describe('motionProblem', () => {
  it('accepts plain settings and sensible ones', () => {
    expect(motionProblem(PLAIN_MOTION, 10_000)).toBeNull()
    expect(motionProblem(m({ freeze: { atMs: 2000, durationMs: 1500 }, speed: { startMs: 0, endMs: 3000, speed: 0.5 }, reverse: true }), 10_000)).toBeNull()
  })
  it('checks fades, freeze and speed against the clip', () => {
    expect(motionProblem(m({ fadeInMs: 6000 }), 10_000)).toMatch(/between 0 and 5 s/)
    expect(motionProblem(m({ fadeInMs: 3000, fadeOutMs: 3000 }), 5000)).toMatch(/longer than the clip/)
    expect(motionProblem(m({ freeze: { atMs: 0, durationMs: 1000 } }), 10_000)).toMatch(/after the start/)
    expect(motionProblem(m({ freeze: { atMs: 12_000, durationMs: 1000 } }), 10_000)).toMatch(/before the end/)
    expect(motionProblem(m({ speed: { startMs: 0, endMs: 3000, speed: 3 } }), 10_000)).toMatch(/Pick a speed/)
    expect(motionProblem(m({ speed: { startMs: 1000, endMs: 1200, speed: 2 } }), 10_000)).toMatch(/at least 0.5 s/)
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
