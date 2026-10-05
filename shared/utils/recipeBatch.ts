// Applying a saved recipe to many videos at once (Videos list › Apply a recipe).
// For each video: the picture settings (crop shape and size, turn, filter, effect,
// fades) become one trim of the whole video, and the layers one text & overlay
// render. Sound settings are left to the editor — they're tied to a video's own
// sound. Each result lands in that video's editor to review. Pure, so it's tested.

import type { EditRecipe, RecipeLayer } from './editRecipe'
import { blockedReason } from './mergeVideos'
import { centeredCrop, orientationRequest } from './videoEdit'
import { lookRequest } from './videoLook'
import { effectRequest, fadeRequest } from './videoEffects'

export interface BatchVideo {
  deleted: boolean
  storageKey?: string | null
  source?: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
}

export interface RecipeJobs {
  /** The trim request for the picture settings; null when the recipe has none. */
  trim: Record<string, unknown> | null
  /** The layers for an overlay render (times kept inside the video); null when the recipe has none. */
  layers: Record<string, unknown>[] | null
  /** Why nothing is queued for this video; null when something is. */
  skip: string | null
}

/** Whether a recipe has anything this batch can apply (picture settings or layers). */
export function batchableRecipe(r: EditRecipe): boolean {
  return !!(r.frame || r.orient || r.look || r.effect || r.fade || r.layers.length)
}

/** The layers as an overlay request for one video: no editor-only fields, and times clamped into the video. */
export function recipeLayersFor(layers: RecipeLayer[], durationMs: number | null): Record<string, unknown>[] {
  return layers
    .map((l) => {
      const { id: _id, imageUrl: _url, imageName: _name, ...layer } = l as RecipeLayer & { imageUrl?: unknown; imageName?: unknown }
      const startMs = Math.max(0, Number(layer.startMs) || 0)
      const endRaw = layer.endMs == null ? null : Number(layer.endMs)
      const endMs = endRaw == null || (durationMs != null && endRaw >= durationMs) ? null : endRaw
      return { ...layer, startMs, endMs }
    })
    .filter((l) => durationMs == null || (l.startMs as number) < durationMs)
    .filter((l) => l.endMs == null || (l.endMs as number) > (l.startMs as number))
}

export function recipeJobs(recipe: EditRecipe, video: BatchVideo): RecipeJobs {
  const blocked = blockedReason(video)
  if (blocked) return { trim: null, layers: null, skip: blocked }
  const durationMs = video.durationSeconds ? video.durationSeconds * 1000 : null

  const picture = !!(recipe.frame || recipe.orient || recipe.look || recipe.effect || recipe.fade)
  let trim: Record<string, unknown> | null = null
  if (picture) {
    if (recipe.frame && (!video.width || !video.height)) return { trim: null, layers: null, skip: "its picture size isn't known yet" }
    const fade = fadeRequest(recipe.fade ?? null)
    if (fade && durationMs != null && fade.inMs + fade.outMs > durationMs) return { trim: null, layers: null, skip: 'too short for the fades' }
    trim = {
      startMs: 0,
      endMs: null,
      crop: recipe.frame ? centeredCrop(recipe.frame.aspect, video.width!, video.height!) : null,
      scale: recipe.frame ? { w: recipe.frame.w, h: recipe.frame.h } : null,
      ...(recipe.orient ? orientationRequest(recipe.orient) : {}),
      look: lookRequest(recipe.look ?? null),
      effect: recipe.effect ? effectRequest(recipe.effect) : undefined,
      fade
    }
  }
  const layers = recipe.layers.length ? recipeLayersFor(recipe.layers, durationMs) : null
  const usableLayers = layers && layers.length ? layers : null
  if (!trim && !usableLayers)
    return { trim: null, layers: null, skip: recipe.layers.length ? 'its layers all start after the video ends' : 'nothing in the recipe applies' }
  return { trim, layers: usableLayers, skip: null }
}
