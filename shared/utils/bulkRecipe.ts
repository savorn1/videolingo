// Applying a saved edit recipe to many videos at once (the Videos list's bulk actions): for each video, the
// edit jobs the recipe stands for — a trim of the whole video for its crop/size and turn, an audio edit for its
// sound settings, an overlay edit for its layers. Each becomes a result in that video's editor to review, as if
// the recipe had been applied there and each tab rendered.
import { centeredCrop, orientationRequest, type Rotation } from './videoEdit'
import { fullAudio, type EditRecipe } from './editRecipe'

export interface RecipeVideo {
  storageKey: string | null
  deleted: boolean
  width: number | null
  height: number | null
  durationMs?: number | null
  durationSeconds: number | null
}

export interface RecipePlan {
  trim: {
    startMs: number
    endMs: null
    crop: { x: number; y: number; w: number; h: number } | null
    scale: { w: number; h: number } | null
    rotate?: 90 | 180 | 270
    flipH?: boolean
    flipV?: boolean
  } | null
  audio: Record<string, unknown> | null
  overlay: Record<string, unknown>[] | null
  /** Why nothing is queued for this video, or why part of the recipe was left out; null when all of it applies. */
  note: string | null
}

/** The jobs a recipe stands for on one video. */
export function recipeJobsFor(recipe: EditRecipe, v: RecipeVideo): RecipePlan {
  const none: RecipePlan = { trim: null, audio: null, overlay: null, note: null }
  if (v.deleted) return { ...none, note: 'in the trash' }
  if (!v.storageKey) return { ...none, note: 'a link video — only stored files can be edited' }
  const durationMs = v.durationMs ?? (v.durationSeconds ? v.durationSeconds * 1000 : 0)
  let note: string | null = null

  let trim: RecipePlan['trim'] = null
  if (recipe.frame || recipe.orient) {
    if (recipe.frame && !(v.width && v.height)) note = 'its picture size is unknown, so the crop and size were left out'
    else {
      const frame = recipe.frame
      trim = {
        startMs: 0,
        endMs: null,
        crop: frame ? centeredCrop(frame.aspect, v.width!, v.height!) : null,
        scale: frame ? { w: frame.w, h: frame.h } : null,
        ...(recipe.orient ? orientationRequest({ ...recipe.orient, rotate: recipe.orient.rotate as Rotation }) : {})
      }
    }
  }

  let audio: RecipePlan['audio'] = null
  if (Object.keys(recipe.audio).length) {
    const a = fullAudio(recipe)
    audio = { replaceKey: null, clips: [], mutes: [], music: null, tracks: [], ...a, keepSoundSpeed: a.speed !== 1 && a.keepSoundSpeed }
  }

  let overlay: RecipePlan['overlay'] = null
  if (recipe.layers.length) {
    const last = Math.max(0, durationMs - 500)
    overlay = recipe.layers.map(({ id: _id, imageUrl: _url, imageName: _name, ...layer }) => {
      const startMs = Math.min(Math.max(0, Number(layer.startMs) || 0), last)
      const endMs = layer.endMs == null ? null : Math.min(Math.max(startMs + 100, Number(layer.endMs)), durationMs || Number(layer.endMs))
      return { ...layer, startMs, endMs }
    })
  }
  return { trim, audio, overlay, note }
}
