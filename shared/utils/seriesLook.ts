// A whole "Video from audio" look saved under a name, for a series made the same way every time:
// the remembered look settings (SavedLook) plus the per-series ones that aren't remembered on their
// own — the title strip, the title card and how pictures are spread. Kept in this browser
// (useSeriesLooks). The logo isn't kept: it's an upload, which the server doesn't hold for long.

import { MAX_STRIP, sanitizeLook, type SavedLook } from './audioVideo'
import type { NamedEntry } from './namedList'

export interface SeriesLook extends SavedLook {
  stripText: string
  titleCard: boolean
  spreadPerRecording: boolean
}

/** A saved look read back from storage, made safe: anything missing or not valid falls back to the default. */
export function sanitizeSeriesLook(raw: unknown): SeriesLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    ...sanitizeLook(r),
    stripText: typeof r.stripText === 'string' ? r.stripText.slice(0, MAX_STRIP) : '',
    titleCard: r.titleCard === true,
    spreadPerRecording: r.spreadPerRecording === true
  }
}

/** The saved list read back from storage: entries that aren't entries are dropped, each look made safe. */
export function sanitizeSeriesLooks(raw: unknown): NamedEntry<SeriesLook>[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (e): e is NamedEntry<unknown> => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string' && typeof e.savedAt === 'number'
    )
    .map((e) => ({ ...e, data: sanitizeSeriesLook(e.data) }))
}

/** "1080p · Tall · Pulse · strip" — what a saved look sets, in a few words. */
export function describeSeriesLook(look: SeriesLook, waveLabel: (style: string) => string): string {
  const parts: string[] = [look.resolution]
  if (look.shape !== 'WIDE') parts.push(look.shape === 'TALL' ? 'Tall' : 'Square')
  parts.push(look.waveform === 'NONE' ? 'no waveform' : waveLabel(look.waveform))
  if (look.stripText.trim()) parts.push('strip')
  if (look.normalize || look.denoise || look.trimSilence) parts.push('sound clean-up')
  return parts.join(' · ')
}
