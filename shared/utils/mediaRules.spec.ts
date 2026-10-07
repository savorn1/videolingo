import { describe, expect, it } from 'vitest'
import { LOCAL_MEDIA_RULES, mediaRulesDrift, offeredWaveforms } from './mediaRules'

describe('mediaRulesDrift', () => {
  it('is empty when the server agrees or says nothing', () => {
    expect(mediaRulesDrift(LOCAL_MEDIA_RULES)).toEqual([])
    expect(mediaRulesDrift({ ...LOCAL_MEDIA_RULES, waveforms: [...LOCAL_MEDIA_RULES.waveforms].reverse() })).toEqual([])
    expect(mediaRulesDrift(null)).toEqual([])
    expect(mediaRulesDrift({})).toEqual([])
  })
  it('names each rule that differs', () => {
    const drift = mediaRulesDrift({ ...LOCAL_MEDIA_RULES, maxSegments: 25, waveforms: ['NONE', 'WAVES'] })
    expect(drift).toHaveLength(2)
    expect(drift[0]).toBe('maxSegments: here 20, server 25')
    expect(drift[1]).toMatch(/^waveforms: here .*; server NONE, WAVES$/)
  })
})

describe('offeredWaveforms', () => {
  it('offers every style when the server does not list them', () => {
    expect(offeredWaveforms(undefined)).toEqual(LOCAL_MEDIA_RULES.waveforms)
    expect(offeredWaveforms([])).toEqual(LOCAL_MEDIA_RULES.waveforms)
  })
  it('keeps only the styles an older server can draw, and always None', () => {
    expect(offeredWaveforms(['WAVES', 'BARS'])).toEqual(['NONE', 'WAVES', 'BARS'])
  })
  it('ignores styles this app does not know', () => {
    expect(offeredWaveforms(['NONE', 'WAVES', 'HOLOGRAM'])).toEqual(['NONE', 'WAVES'])
  })
})
