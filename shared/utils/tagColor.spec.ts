import { describe, expect, it } from 'vitest'
import { TAG_TONE_COUNT, tagTone } from './tagColor'

describe('tagTone', () => {
  it('gives the same name the same colour every time', () => {
    expect(tagTone('grammar')).toBe(tagTone('grammar'))
  })
  it('ignores case and surrounding spaces', () => {
    expect(tagTone('Grammar')).toBe(tagTone('grammar'))
    expect(tagTone('  grammar ')).toBe(tagTone('grammar'))
  })
  it('spreads different names over several colours', () => {
    const names = ['grammar', 'vocabulary', 'listening', 'speaking', 'beginner', 'advanced', 'travel', 'business', 'idioms', 'pronunciation', 'exam', 'daily']
    const used = new Set(names.map((n) => tagTone(n).chip))
    expect(used.size).toBeGreaterThanOrEqual(5)
    expect(used.size).toBeLessThanOrEqual(TAG_TONE_COUNT)
  })
  it('copes with an empty or missing name', () => {
    expect(tagTone('').chip).toBeTruthy()
    expect(tagTone(null)).toBe(tagTone(undefined))
  })
  it('pairs each chip with a hash colour of the same family', () => {
    for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      const t = tagTone(n)
      const family = /bg-(\w+)-100/.exec(t.chip)![1]
      expect(t.hash).toContain(`text-${family}-600`)
    }
  })
})
