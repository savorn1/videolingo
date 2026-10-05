// A picture look for a trim (the editor's "Filter"): brightness, contrast, colour,
// warmth, tint, sharpen, blur, vignette. The backend renders it (VideoEditRules.Look
// + ffmpeg) and re-checks the ranges; the preview uses a CSS filter plus a tinted
// layer for warmth, which match closely but aren't exact, and can't show the
// vignette or the sharpening.

export interface VideoLook {
  /** −1…1, 0 = unchanged. */
  brightness: number
  /** 0…2, 1 = unchanged. */
  contrast: number
  /** 0…3, 1 = unchanged. */
  saturation: number
  /** 0…MAX_LOOK_BLUR, 0 = none. */
  blur: number
  grayscale: boolean
  sepia: boolean
  vignette: boolean
  /** −1…1: cooler (blue) to warmer (orange), 0 = unchanged. */
  warmth: number
  sharpen: boolean
}

export const MAX_LOOK_BLUR = 20

export const PLAIN_LOOK: VideoLook = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  blur: 0,
  grayscale: false,
  sepia: false,
  vignette: false,
  warmth: 0,
  sharpen: false
}

export interface LookPreset {
  key: string
  label: string
  look: VideoLook
}

export const LOOK_PRESETS: LookPreset[] = [
  { key: 'vivid', label: 'Vivid', look: { ...PLAIN_LOOK, contrast: 1.15, saturation: 1.4 } },
  { key: 'bright', label: 'Bright', look: { ...PLAIN_LOOK, brightness: 0.12, contrast: 1.05 } },
  { key: 'moody', label: 'Moody', look: { ...PLAIN_LOOK, brightness: -0.08, contrast: 1.2, saturation: 0.85, vignette: true } },
  { key: 'mono', label: 'Black & white', look: { ...PLAIN_LOOK, contrast: 1.1, grayscale: true } },
  { key: 'sepia', label: 'Sepia', look: { ...PLAIN_LOOK, sepia: true } },
  { key: 'soft', label: 'Soft', look: { ...PLAIN_LOOK, brightness: 0.05, contrast: 0.9, blur: 1.5 } },
  { key: 'warm', label: 'Warm', look: { ...PLAIN_LOOK, warmth: 0.5, saturation: 1.1 } },
  { key: 'cool', label: 'Cool', look: { ...PLAIN_LOOK, warmth: -0.5, contrast: 1.05 } },
  { key: 'vintage', label: 'Vintage', look: { ...PLAIN_LOOK, warmth: 0.35, contrast: 0.9, saturation: 0.75, vignette: true } },
  { key: 'crisp', label: 'Crisp', look: { ...PLAIN_LOOK, contrast: 1.1, saturation: 1.1, sharpen: true } }
]

export function isPlainLook(look: VideoLook | null): boolean {
  if (!look) return true
  return (
    look.brightness === 0 &&
    look.contrast === 1 &&
    look.saturation === 1 &&
    look.blur === 0 &&
    !look.grayscale &&
    !look.sepia &&
    !look.vignette &&
    !look.warmth &&
    !look.sharpen
  )
}

/** The preset the look matches exactly, or null. */
export function matchingPreset(look: VideoLook | null): LookPreset | null {
  if (!look || isPlainLook(look)) return null
  return LOOK_PRESETS.find((p) => (Object.keys(p.look) as (keyof VideoLook)[]).every((k) => p.look[k] === look[k])) ?? null
}

/** Null = fine; otherwise why this look can't be rendered. */
export function validateLook(look: VideoLook | null): string | null {
  if (!look) return null
  if (!(look.brightness >= -1 && look.brightness <= 1)) return 'Brightness is between −100 % and +100 %'
  if (!(look.contrast >= 0 && look.contrast <= 2)) return 'Contrast is between 0 % and 200 %'
  if (!(look.saturation >= 0 && look.saturation <= 3)) return 'Colour is between 0 % and 300 %'
  if (!(look.blur >= 0 && look.blur <= MAX_LOOK_BLUR)) return `Blur is between 0 and ${MAX_LOOK_BLUR}`
  if (!((look.warmth ?? 0) >= -1 && (look.warmth ?? 0) <= 1)) return 'Warmth is between −100 % and +100 %'
  return null
}

/** The `look` part of a trim request: null when nothing is changed, so a plain trim is sent as before. */
export function lookRequest(look: VideoLook | null): VideoLook | null {
  return look && !isPlainLook(look) ? { ...look } : null
}

/** A CSS `filter` for the preview <video>; '' when nothing is changed. */
export function cssFilter(look: VideoLook | null): string {
  if (!look || isPlainLook(look)) return ''
  const parts: string[] = []
  // CSS brightness is a multiplier; ffmpeg's is an offset — 1 + offset is close enough to judge by eye.
  if (look.brightness !== 0) parts.push(`brightness(${+(1 + look.brightness).toFixed(3)})`)
  if (look.contrast !== 1) parts.push(`contrast(${+look.contrast.toFixed(3)})`)
  if (look.grayscale) parts.push('grayscale(1)')
  else if (look.saturation !== 1) parts.push(`saturate(${+look.saturation.toFixed(3)})`)
  if (look.sepia && !look.grayscale) parts.push('sepia(1)')
  if (look.blur > 0) parts.push(`blur(${+(look.blur / 2).toFixed(2)}px)`)
  return parts.join(' ')
}

/** One line for the trim summary, e.g. "brighter, black & white"; null for a plain look. */
export function describeVideoLook(look: VideoLook | null): string | null {
  if (!look || isPlainLook(look)) return null
  const preset = matchingPreset(look)
  if (preset) return `${preset.label} look`
  const parts: string[] = []
  if (look.brightness !== 0) parts.push(look.brightness > 0 ? 'brighter' : 'darker')
  if (look.contrast !== 1) parts.push(look.contrast > 1 ? 'more contrast' : 'less contrast')
  if (look.saturation !== 1 && !look.grayscale && !look.sepia) parts.push(look.saturation > 1 ? 'more colour' : 'less colour')
  if (look.warmth && !look.grayscale) parts.push(look.warmth > 0 ? 'warmer' : 'cooler')
  if (look.grayscale) parts.push('black & white')
  else if (look.sepia) parts.push('sepia')
  if (look.sharpen) parts.push('sharpened')
  if (look.blur > 0) parts.push('blurred')
  if (look.vignette) parts.push('vignette')
  return parts.join(', ')
}

/** The preview's stand-in for warmth: an orange or blue layer blended over the picture. Null when there is none to show. */
export function warmthTint(look: VideoLook | null): { background: string; opacity: number } | null {
  if (!look?.warmth || look.grayscale) return null
  return { background: look.warmth > 0 ? '#ff8a00' : '#0077ff', opacity: +(Math.abs(look.warmth) * 0.35).toFixed(3) }
}

/** The preview's stand-in for dark corners (the render uses ffmpeg's vignette): a radial shade from the edges. */
export const VIGNETTE_GRADIENT = 'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%)'
