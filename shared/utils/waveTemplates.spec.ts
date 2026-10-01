import { describe, expect, it } from 'vitest'
import { BUILTIN_WAVE_TEMPLATES, contrastRatio, isWaveLook, luminance, sanitizeWaveTemplates } from './waveTemplates'

describe('built-in wave templates', () => {
  it('have unique ids and names', () => {
    expect(new Set(BUILTIN_WAVE_TEMPLATES.map((t) => t.id)).size).toBe(BUILTIN_WAVE_TEMPLATES.length)
    expect(new Set(BUILTIN_WAVE_TEMPLATES.map((t) => t.name)).size).toBe(BUILTIN_WAVE_TEMPLATES.length)
  })
  it('can all be drawn by the server', () => {
    for (const t of BUILTIN_WAVE_TEMPLATES) expect(isWaveLook(t.look), t.id).toBe(true)
  })
  it('keep the line easy to see against the background', () => {
    for (const t of BUILTIN_WAVE_TEMPLATES) expect(contrastRatio(t.look.waveColor, t.look.background), t.id).toBeGreaterThanOrEqual(4.5)
  })
  it('use every drawable style at least once', () => {
    expect(new Set(BUILTIN_WAVE_TEMPLATES.map((t) => t.look.waveform))).toEqual(
      new Set(['WAVES', 'BARS', 'SPIKES', 'DOTS', 'SPECTRUM', 'PULSE', 'BLOCKS', 'FINE', 'STRIPES'])
    )
  })
})

describe('contrast', () => {
  it('is 21 for black on white and 1 for the same colour', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#336699', '#336699')).toBe(1)
  })
  it('does not depend on the order', () => {
    expect(contrastRatio('#111827', '#ffffff')).toBe(contrastRatio('#ffffff', '#111827'))
  })
  it('treats an invalid colour as black', () => {
    expect(luminance('nope')).toBe(0)
  })
})

describe('isWaveLook / sanitizeWaveTemplates', () => {
  const good = { waveform: 'BARS', waveColor: '#ff0000', background: '#000000' }
  it('rejects no waveform, unknown styles and bad colours', () => {
    expect(isWaveLook(good)).toBe(true)
    expect(isWaveLook({ ...good, waveform: 'NONE' })).toBe(false)
    expect(isWaveLook({ ...good, waveform: 'ZIGZAG' })).toBe(false)
    expect(isWaveLook({ ...good, waveColor: 'red' })).toBe(false)
    expect(isWaveLook(null)).toBe(false)
  })
  it('keeps only well-formed saved entries', () => {
    const entry = { id: 'n1', name: 'Mine', savedAt: 1, data: good }
    expect(sanitizeWaveTemplates([entry, { id: 'n2' }, { ...entry, id: 'n3', data: { ...good, background: 'x' } }, null])).toEqual([entry])
    expect(sanitizeWaveTemplates('nope')).toEqual([])
  })
})
