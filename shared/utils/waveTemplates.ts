// Ready-made looks for the moving waveform on "Video from audio": a waveform style with
// the colours that suit it, in one click. They set only what the server can draw — the
// style, the line colour and the background colour — so anything here is renderable.
// Your own can be saved next to them (useWaveTemplates).

import { WAVEFORM_STYLES, isHexColor, normalizeHexColor, type WaveformStyle } from './audioVideo'
import type { NamedEntry } from './namedList'

export interface WaveLook {
  waveform: Exclude<WaveformStyle, 'NONE'>
  /** Line / bar colour, `#rrggbb`. */
  waveColor: string
  /** Background colour, `#rrggbb`. */
  background: string
}

export interface WaveTemplate {
  id: string
  name: string
  hint: string
  look: WaveLook
}

export const BUILTIN_WAVE_TEMPLATES: WaveTemplate[] = [
  { id: 'podcast', name: 'Podcast', hint: 'Calm line on deep navy', look: { waveform: 'WAVES', waveColor: '#7dd3fc', background: '#0f172a' } },
  { id: 'neon', name: 'Neon', hint: 'Hot-pink bars in the dark', look: { waveform: 'BARS', waveColor: '#ff3df2', background: '#0b0220' } },
  { id: 'minimal', name: 'Minimal', hint: 'Thin dark line on white', look: { waveform: 'WAVES', waveColor: '#111827', background: '#ffffff' } },
  { id: 'retro', name: 'Retro', hint: 'Amber dots on warm brown', look: { waveform: 'DOTS', waveColor: '#fbbf24', background: '#2a1708' } },
  { id: 'studio', name: 'Studio', hint: 'Green spectrum on black', look: { waveform: 'SPECTRUM', waveColor: '#4ade80', background: '#000000' } },
  { id: 'sunrise', name: 'Sunrise', hint: 'Bright sticks on deep red', look: { waveform: 'SPIKES', waveColor: '#fde68a', background: '#7f1d1d' } },
  { id: 'ocean', name: 'Ocean', hint: 'Soft white bars on blue', look: { waveform: 'BARS', waveColor: '#e0f2fe', background: '#1e3a8a' } },
  { id: 'forest', name: 'Forest', hint: 'Light sticks on dark green', look: { waveform: 'SPIKES', waveColor: '#bbf7d0', background: '#064e3b' } },
  { id: 'paper', name: 'Paper', hint: 'Ink dots on cream', look: { waveform: 'DOTS', waveColor: '#1f2937', background: '#fef3c7' } },
  { id: 'signal', name: 'Signal', hint: 'Thin white pulse on royal blue', look: { waveform: 'PULSE', waveColor: '#ffffff', background: '#0a0a9b' } },
  { id: 'night-pulse', name: 'Night pulse', hint: 'Cyan pulse on near-black', look: { waveform: 'PULSE', waveColor: '#22d3ee', background: '#020617' } },
  { id: 'mint-pulse', name: 'Mint pulse', hint: 'Dark pulse on mint', look: { waveform: 'PULSE', waveColor: '#064e3b', background: '#d1fae5' } },
  { id: 'blocks-sunset', name: 'Sunset blocks', hint: 'Cream blocks on orange-red', look: { waveform: 'BLOCKS', waveColor: '#fff7ed', background: '#9a3412' } },
  { id: 'fine-white', name: 'Hairline', hint: 'Hair-thin white bars on deep blue', look: { waveform: 'FINE', waveColor: '#ffffff', background: '#0b1b8f' } },
  { id: 'fine-gold', name: 'Gold hairline', hint: 'Fine gold bars on black', look: { waveform: 'FINE', waveColor: '#fcd34d', background: '#0a0a0a' } },
  {
    id: 'stripes-coral',
    name: 'Coral stripes',
    hint: 'Medium white bars on coral',
    look: { waveform: 'STRIPES', waveColor: '#ffffff', background: '#b91c1c' }
  },
  { id: 'stripes-slate', name: 'Slate stripes', hint: 'Sky-blue bars on slate', look: { waveform: 'STRIPES', waveColor: '#bae6fd', background: '#1e293b' } },
  { id: 'lecture', name: 'Lecture', hint: 'Clear yellow line on charcoal', look: { waveform: 'WAVES', waveColor: '#facc15', background: '#1f2937' } }
]

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Relative luminance of a `#rrggbb` colour (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const h = normalizeHexColor(hex)
  if (!h) return 0
  const n = parseInt(h.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

/** WCAG-style contrast ratio between two colours, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Whether a look can be drawn: a real style and two valid colours. */
export function isWaveLook(v: unknown): v is WaveLook {
  if (!v || typeof v !== 'object') return false
  const l = v as Record<string, unknown>
  return (
    typeof l.waveform === 'string' &&
    l.waveform !== 'NONE' &&
    WAVEFORM_STYLES.some((s) => s.value === l.waveform) &&
    typeof l.waveColor === 'string' &&
    isHexColor(l.waveColor) &&
    typeof l.background === 'string' &&
    isHexColor(l.background)
  )
}

/** Saved looks read back from storage: only well-formed ones, with colours in `#rrggbb`. */
export function sanitizeWaveTemplates(raw: unknown): NamedEntry<WaveLook>[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is NamedEntry<WaveLook> =>
      !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.savedAt === 'number' && isWaveLook(e.data)
  )
}
