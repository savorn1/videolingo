import { describe, expect, it } from 'vitest'
import { audioDifferences, describeRecipe, fullAudio, isRecipeEmpty, sanitizeRecipe, sanitizeRecipes, type EditRecipe } from './editRecipe'

const layer = { id: 'a', kind: 'TEXT' as const, text: 'Hi' }

describe('audioDifferences', () => {
  it('keeps only what differs from the defaults', () => {
    expect(audioDifferences({ volume: 1, normalize: true, speed: 1.25, denoise: 'OFF' })).toEqual({ normalize: true, speed: 1.25 })
  })
})

describe('describeRecipe / isRecipeEmpty', () => {
  const recipe: EditRecipe = { frame: { aspect: 9 / 16, w: 1080, h: 1920 }, audio: { normalize: true, speed: 1.2 }, layers: [layer] }
  it('describes what it holds', () => {
    expect(describeRecipe(recipe)).toBe('Crop 9:16 · 1080×1920 · 2 sound settings · 1 layer')
  })
  it('knows when it holds nothing', () => {
    expect(isRecipeEmpty({ frame: null, audio: {}, layers: [] })).toBe(true)
    expect(isRecipeEmpty(recipe)).toBe(false)
  })
})

describe('fullAudio', () => {
  it('fills in the defaults a recipe leaves out', () => {
    expect(fullAudio({ frame: null, audio: { speed: 1.5 }, layers: [] })).toMatchObject({ speed: 1.5, volume: 1, denoise: 'OFF' })
  })
})

describe('sanitizeRecipe', () => {
  it('accepts a good recipe', () => {
    expect(sanitizeRecipe({ frame: { aspect: 1, w: 1080, h: 1080 }, audio: { normalize: true }, layers: [layer] })).toEqual({
      frame: { aspect: 1, w: 1080, h: 1080 },
      audio: { normalize: true },
      layers: [layer]
    })
  })
  it('drops audio values of the wrong type and layers without an id or kind', () => {
    const r = sanitizeRecipe({
      frame: null,
      audio: { speed: 'fast', normalize: true, volume: NaN },
      layers: [layer, { kind: 'TEXT' }, { id: 'b', kind: 'VIDEO' }]
    })
    expect(r).toEqual({ frame: null, audio: { normalize: true }, layers: [layer] })
  })
  it('rejects a bad frame, junk, and recipes with nothing in them', () => {
    expect(sanitizeRecipe({ frame: { aspect: -1, w: 1, h: 1 }, audio: {}, layers: [layer] })).toBeNull()
    expect(sanitizeRecipe('x')).toBeNull()
    expect(sanitizeRecipe({ frame: null, audio: {}, layers: [] })).toBeNull()
  })
})

describe('sanitizeRecipes', () => {
  it('keeps only well-formed entries', () => {
    const good = { id: 'n1', name: 'Reel look', savedAt: 1, data: { frame: null, audio: { normalize: true }, layers: [] } }
    expect(sanitizeRecipes([good, { id: 'n2' }, null, { ...good, id: 'n3', data: 5 }])).toEqual([good])
    expect(sanitizeRecipes('nope')).toEqual([])
  })
})

describe('turn and flip in a recipe', () => {
  it('is kept, counted as content, and described', () => {
    const r = sanitizeRecipe({ frame: null, orient: { rotate: 90, flipH: false, flipV: true }, audio: {}, layers: [] })
    expect(r).toEqual({ frame: null, orient: { rotate: 90, flipH: false, flipV: true }, audio: {}, layers: [] })
    expect(describeRecipe(r!)).toBe('Turn / flip')
    expect(isRecipeEmpty(r!)).toBe(false)
  })
  it('is dropped when it changes nothing or is malformed', () => {
    expect(sanitizeRecipe({ frame: null, orient: { rotate: 0, flipH: false, flipV: false }, audio: { normalize: true }, layers: [] })).toEqual({
      frame: null,
      audio: { normalize: true },
      layers: []
    })
    expect(sanitizeRecipe({ frame: null, orient: { rotate: 45, flipH: false, flipV: false }, audio: { normalize: true }, layers: [] })?.orient).toBeUndefined()
  })
})
