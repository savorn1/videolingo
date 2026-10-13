import { describe, expect, it } from 'vitest'
import { recipeJobsFor } from './bulkRecipe'
import type { EditRecipe } from './editRecipe'

const video = { storageKey: 'videos/a.mp4', deleted: false, width: 1920, height: 1080, durationMs: 10_000, durationSeconds: 10 }
const tall: EditRecipe = { frame: { aspect: 9 / 16, w: 1080, h: 1920 }, audio: {}, layers: [] }

describe('recipeJobsFor', () => {
  it('turns a crop shape into a centred crop of each video, with its size', () => {
    const plan = recipeJobsFor(tall, video)
    expect(plan.trim).toMatchObject({ startMs: 0, endMs: null, scale: { w: 1080, h: 1920 } })
    expect(plan.trim!.crop!.h).toBe(1080)
    expect(plan.trim!.crop!.x).toBeGreaterThan(0)
    expect(plan.audio).toBeNull()
    expect(plan.overlay).toBeNull()
    expect(plan.note).toBeNull()
  })
  it('sends the whole sound setup, with no clips, music or replacement', () => {
    const plan = recipeJobsFor({ frame: null, audio: { normalize: true, speed: 0.5, keepSoundSpeed: true }, layers: [] }, video)
    expect(plan.audio).toMatchObject({ normalize: true, volume: 1, speed: 0.5, keepSoundSpeed: true, clips: [], music: null, replaceKey: null })
    expect(plan.trim).toBeNull()
  })
  it('copies layers without their editor ids, times kept inside the video', () => {
    const plan = recipeJobsFor(
      { frame: null, audio: {}, layers: [{ id: 'x', kind: 'TEXT', text: 'Hi', startMs: 20_000, endMs: 25_000, imageUrl: 'blob:1' }] },
      video
    )
    expect(plan.overlay).toEqual([{ kind: 'TEXT', text: 'Hi', startMs: 9500, endMs: 10_000 }])
  })
  it('skips link videos and the trash, and leaves out a crop when the size is unknown', () => {
    expect(recipeJobsFor(tall, { ...video, storageKey: null }).note).toMatch(/link video/)
    expect(recipeJobsFor(tall, { ...video, deleted: true }).note).toBe('in the trash')
    const unknown = recipeJobsFor(tall, { ...video, width: null })
    expect(unknown.trim).toBeNull()
    expect(unknown.note).toMatch(/size is unknown/)
  })
  it('turns without a crop when the recipe only turns', () => {
    const plan = recipeJobsFor({ frame: null, orient: { rotate: 90, flipH: false, flipV: true }, audio: {}, layers: [] }, video)
    expect(plan.trim).toEqual({ startMs: 0, endMs: null, crop: null, scale: null, rotate: 90, flipV: true })
  })
})
