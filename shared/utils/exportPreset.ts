// Saved "Export for" presets: a crop shape plus an output size, kept in the
// browser next to the four built into the editor. Pure helpers, so the rules
// (what can be saved, what is trusted when read back) are testable.

import type { NamedEntry } from './namedList'

export interface ExportPresetData {
  /** Crop shape as width / height, e.g. 16 / 9. */
  aspect: number
  /** Output size in pixels. */
  w: number
  h: number
}

/** Bounds for a size read back from storage. */
export const MAX_PRESET_SIDE = 16_384

/** Whether something read from storage is a usable preset. */
export function isPresetData(v: unknown): v is ExportPresetData {
  if (!v || typeof v !== 'object') return false
  const { aspect, w, h } = v as Record<string, unknown>
  return (
    typeof aspect === 'number' &&
    Number.isFinite(aspect) &&
    aspect > 0 &&
    [w, h].every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_PRESET_SIDE)
  )
}

/** The preset the editor's current settings make, or null when crop and resize aren't both set with a fixed shape. */
export function presetFromSettings(cropOn: boolean, cropAspect: number | null, scaleOn: boolean, scale: { w: number; h: number }): ExportPresetData | null {
  if (!cropOn || !scaleOn || !cropAspect) return null
  const data = { aspect: cropAspect, w: Math.round(scale.w), h: Math.round(scale.h) }
  return isPresetData(data) ? data : null
}

/** "16:9", "9:16", "4:3"… for a shape; a decimal such as "1.37:1" when no small whole-number ratio fits. */
export function ratioLabel(aspect: number): string {
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(aspect * d)
    if (n > 0 && Math.abs(n / d - aspect) < 0.002) {
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
      const g = gcd(n, d)
      return `${n / g}:${d / g}`
    }
  }
  return `${+aspect.toFixed(2)}:1`
}

/** Keeps only well-formed saved presets from whatever was in storage. */
export function sanitizePresets(raw: unknown): NamedEntry<ExportPresetData>[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is NamedEntry<ExportPresetData> =>
      !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.savedAt === 'number' && isPresetData(e.data)
  )
}
