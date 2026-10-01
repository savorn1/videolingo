// Saved "recipes": the settings of an edit that make sense on any video — the
// crop shape and output size, the sound settings, and the text & image layers —
// so a look worked out once can be applied to the next video. What belongs to one
// video's timeline (the trim range, split points, audio clips, muted ranges, an
// uploaded replacement sound) is left out. Pure helpers, so it's testable.

import type { NamedEntry } from './namedList'
import { isPresetData, ratioLabel } from './exportPreset'

export interface RecipeAudio {
  volume: number
  fadeInMs: number
  fadeOutMs: number
  normalize: boolean
  denoise: 'OFF' | 'LIGHT' | 'STRONG'
  enhanceVoice: boolean
  speed: number
  pitchSemitones: number
  balance: number
  channels: 'KEEP' | 'MONO' | 'STEREO'
}

export const DEFAULT_RECIPE_AUDIO: RecipeAudio = {
  volume: 1,
  fadeInMs: 0,
  fadeOutMs: 0,
  normalize: false,
  denoise: 'OFF',
  enhanceVoice: false,
  speed: 1,
  pitchSemitones: 0,
  balance: 0,
  channels: 'KEEP'
}

export interface RecipeLayer {
  id: string
  kind: 'TEXT' | 'IMAGE'
  [key: string]: unknown
}

export interface EditRecipe {
  /** Crop shape and output size; null = leave the picture alone. */
  frame: { aspect: number; w: number; h: number } | null
  /** Turn and flip; absent = leave the picture's direction alone. */
  orient?: { rotate: 90 | 180 | 270 | 0; flipH: boolean; flipV: boolean }
  /** Only the settings that differ from the defaults. */
  audio: Partial<RecipeAudio>
  layers: RecipeLayer[]
}

export type SavedRecipe = NamedEntry<EditRecipe>

const AUDIO_KEYS = Object.keys(DEFAULT_RECIPE_AUDIO) as (keyof RecipeAudio)[]

/** Only what differs from the untouched sound. */
export function audioDifferences(audio: Partial<RecipeAudio>): Partial<RecipeAudio> {
  const out: Record<string, unknown> = {}
  for (const k of AUDIO_KEYS) if (audio[k] !== undefined && audio[k] !== DEFAULT_RECIPE_AUDIO[k]) out[k] = audio[k]
  return out as Partial<RecipeAudio>
}

/** The full set of audio settings a recipe stands for (what it leaves out is the default). */
export function fullAudio(recipe: EditRecipe): RecipeAudio {
  return { ...DEFAULT_RECIPE_AUDIO, ...recipe.audio }
}

export function isRecipeEmpty(r: EditRecipe): boolean {
  return !r.frame && !r.orient && !Object.keys(r.audio).length && !r.layers.length
}

/** One line on what a recipe holds: "Crop 9:16 · 1080×1920 · 3 sound settings · 2 text layers". */
export function describeRecipe(r: EditRecipe): string {
  const parts: string[] = []
  if (r.frame) parts.push(`Crop ${ratioLabel(r.frame.aspect)} · ${r.frame.w}×${r.frame.h}`)
  if (r.orient) parts.push('Turn / flip')
  const n = Object.keys(r.audio).length
  if (n) parts.push(`${n} sound setting${n === 1 ? '' : 's'}`)
  if (r.layers.length) parts.push(`${r.layers.length} layer${r.layers.length === 1 ? '' : 's'}`)
  return parts.join(' · ') || 'Nothing'
}

function isLayer(v: unknown): v is RecipeLayer {
  return (
    !!v && typeof v === 'object' && typeof (v as RecipeLayer).id === 'string' && ((v as RecipeLayer).kind === 'TEXT' || (v as RecipeLayer).kind === 'IMAGE')
  )
}

/** A recipe read back from storage, or null when it isn't one. Audio values are checked against the defaults' types. */
export function sanitizeRecipe(raw: unknown): EditRecipe | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const frame = r.frame == null ? null : isPresetData(r.frame) ? { aspect: r.frame.aspect, w: r.frame.w, h: r.frame.h } : undefined
  if (frame === undefined) return null
  const audioIn = r.audio && typeof r.audio === 'object' ? (r.audio as Record<string, unknown>) : {}
  const audio: Record<string, unknown> = {}
  for (const k of AUDIO_KEYS) {
    const v = audioIn[k]
    if (v !== undefined && typeof v === typeof DEFAULT_RECIPE_AUDIO[k] && (typeof v !== 'number' || Number.isFinite(v))) audio[k] = v
  }
  const layers = Array.isArray(r.layers) ? r.layers.filter(isLayer) : []
  const o = r.orient && typeof r.orient === 'object' ? (r.orient as Record<string, unknown>) : null
  const orient =
    o &&
    [0, 90, 180, 270].includes(o.rotate as number) &&
    typeof o.flipH === 'boolean' &&
    typeof o.flipV === 'boolean' &&
    (o.rotate !== 0 || o.flipH || o.flipV)
      ? { rotate: o.rotate as 0 | 90 | 180 | 270, flipH: o.flipH, flipV: o.flipV }
      : undefined
  const recipe: EditRecipe = { frame, ...(orient ? { orient } : {}), audio: audioDifferences(audio as Partial<RecipeAudio>), layers }
  return isRecipeEmpty(recipe) ? null : recipe
}

export function sanitizeRecipes(raw: unknown): SavedRecipe[] {
  if (!Array.isArray(raw)) return []
  const out: SavedRecipe[] = []
  for (const e of raw) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.savedAt !== 'number') continue
    const data = sanitizeRecipe(e.data)
    if (data) out.push({ id: e.id, name: e.name, savedAt: e.savedAt, data })
  }
  return out
}
