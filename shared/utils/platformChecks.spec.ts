import { describe, expect, it } from 'vitest'
import { platformChecks } from './platformChecks'

const facts = { lengthMs: 45_000, w: 1080, h: 1920, introMs: 0, fadeInMs: 0 }

describe('platformChecks', () => {
  it('passes a Short that fits', () => {
    expect(platformChecks('shorts', facts)!.every((c) => c.ok)).toBe(true)
  })
  it('warns about a long, small Short that opens on a card from black', () => {
    const failed = platformChecks('shorts', { lengthMs: 200_000, w: 720, h: 1280, introMs: 3000, fadeInMs: 500 })!
      .filter((c) => !c.ok)
      .map((c) => c.text)
    expect(failed).toHaveLength(4)
    expect(failed[1]).toContain('up to 3 min; TikTok takes it')
  })
  it('flags the wrong shape and X past 2:20', () => {
    const x = platformChecks('twitter', { ...facts, lengthMs: 150_000 })!
    expect(x[0]!.ok).toBe(false)
    expect(x[2]!.text).toContain('2:20')
  })
  it('has nothing to say about a preset of your own', () => {
    expect(platformChecks('custom-1', facts)).toBeNull()
  })
})
