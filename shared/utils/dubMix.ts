// How a voice-over (dub) is mixed with the video's own sound while watching: each at its own level, 0–1.
// The voice-over alone is the default; keeping a little of the original lets a learner still hear the speaker.

export interface DubMix {
  voice: number
  original: number
}

export const DEFAULT_DUB_MIX: DubMix = { voice: 1, original: 0 }

export const DUB_MIX_PRESETS: readonly { label: string; mix: DubMix }[] = [
  { label: 'Voice-over only', mix: { voice: 1, original: 0 } },
  { label: 'Original underneath', mix: { voice: 1, original: 0.2 } },
  { label: 'Both', mix: { voice: 1, original: 0.7 } }
]

function level(v: unknown, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.round(Math.min(1, Math.max(0, n)) * 20) / 20
}

/** A mix as stored in the browser, made safe: each level 0–1 in steps of 5 %, the default for anything unreadable. */
export function sanitizeDubMix(raw: unknown): DubMix {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { voice: level(o.voice, DEFAULT_DUB_MIX.voice), original: level(o.original, DEFAULT_DUB_MIX.original) }
}

/** Whether a mix is one of the presets. */
export function isDubMixPreset(mix: DubMix, preset: DubMix): boolean {
  return mix.voice === preset.voice && mix.original === preset.original
}
