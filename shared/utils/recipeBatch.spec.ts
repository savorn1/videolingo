import { describe, expect, it } from 'vitest'
import { batchableRecipe, recipeJobs, recipeLayersFor } from './recipeBatch'
import type { EditRecipe } from './editRecipe'
import { PLAIN_LOOK } from './videoLook'

const video = { deleted: false, storageKey: 'videos/1.mp4', source: 'UPLOAD', width: 1920, height: 1080, durationSeconds: 60 }
const empty: EditRecipe = { frame: null, audio: {}, layers: [] }
const layer = { id: 'a', kind: 'TEXT' as const, text: 'Hi', startMs: 1000, endMs: 90_000, imageUrl: 'https://x/a.png', imageName: 'a.png' }

describe('recipeJobs', () => {
  it('turns picture settings into one whole-video trim', () => {
    const r: EditRecipe = {
      ...empty,
      frame: { aspect: 9 / 16, w: 1080, h: 1920 },
      orient: { rotate: 90, flipH: false, flipV: false },
      look: { ...PLAIN_LOOK, warmth: 0.5 },
      effect: 'ZOOM_IN',
      fade: { inMs: 1000, outMs: 0, color: 'BLACK' }
    }
    const jobs = recipeJobs(r, video)
    expect(jobs.skip).toBeNull()
    expect(jobs.layers).toBeNull()
    expect(jobs.trim).toMatchObject({ startMs: 0, endMs: null, scale: { w: 1080, h: 1920 }, rotate: 90, effect: 'ZOOM_IN', fade: { inMs: 1000, outMs: 0 } })
    expect((jobs.trim!.crop as { h: number }).h).toBe(1080)
    expect((jobs.trim!.look as { warmth: number }).warmth).toBe(0.5)
  })
  it('turns layers into an overlay request, clamped into the video', () => {
    const jobs = recipeJobs({ ...empty, layers: [layer] }, video)
    expect(jobs.trim).toBeNull()
    expect(jobs.layers).toEqual([{ kind: 'TEXT', text: 'Hi', startMs: 1000, endMs: null }])
  })
  it('skips links, trashed videos, unknown sizes and videos too short for the fades', () => {
    const r: EditRecipe = { ...empty, frame: { aspect: 1, w: 1080, h: 1080 } }
    expect(recipeJobs(r, { ...video, source: 'YOUTUBE', storageKey: null }).skip).toMatch(/link/)
    expect(recipeJobs(r, { ...video, deleted: true }).skip).toMatch(/trash/)
    expect(recipeJobs(r, { ...video, width: null }).skip).toMatch(/size/)
    expect(recipeJobs({ ...empty, fade: { inMs: 4000, outMs: 4000, color: 'BLACK' } }, { ...video, durationSeconds: 5 }).skip).toMatch(/fades/)
  })
  it('says so when nothing applies', () => {
    expect(recipeJobs(empty, video).skip).toMatch(/nothing/)
    expect(recipeJobs({ ...empty, layers: [{ ...layer, startMs: 120_000, endMs: null }] }, video).skip).toMatch(/after the video ends/)
  })
})

describe('batchableRecipe / recipeLayersFor', () => {
  it('needs picture settings or layers (sound alone is editor-only)', () => {
    expect(batchableRecipe(empty)).toBe(false)
    expect(batchableRecipe({ ...empty, audio: { volume: 2 } })).toBe(false)
    expect(batchableRecipe({ ...empty, effect: 'GLITCH' })).toBe(true)
  })
  it('drops layers that end before they start once clamped', () => {
    expect(recipeLayersFor([{ id: 'x', kind: 'TEXT', startMs: 5000, endMs: 4000 }], 60_000)).toEqual([])
  })
})
