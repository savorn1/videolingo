// Turning real audio samples into what the waveform sketches draw, so the preview on the
// "Video from audio" page moves with the user's own sound. The server draws one short slice of
// the sound per video frame (about 1/15 s) across the width of the band, one column at a time;
// this does the same with the samples the browser decoded.

/** Frames per second the server draws a waveform at (AudioToVideoRules.WAVE_FPS). */
export const WAVE_FPS = 15

/** Seconds of sound the page keeps for the preview; it loops over them. */
export const PREVIEW_SECONDS = 8

/** The styles the page can draw from raw samples. BARS and SPECTRUM need a frequency analysis, so they keep the sketch. */
export const REAL_STYLES = ['WAVES', 'SPIKES', 'DOTS', 'PULSE', 'BLOCKS', 'FINE', 'STRIPES'] as const
export type RealStyle = (typeof REAL_STYLES)[number]

export function canDrawFromAudio(style: string): style is RealStyle {
  return (REAL_STYLES as readonly string[]).includes(style)
}

/** How many columns each style draws across the picture. Mirrors the server's bar counts. */
export const COLUMNS: Record<RealStyle, number> = { WAVES: 100, SPIKES: 50, DOTS: 34, PULSE: 41, BLOCKS: 18, FINE: 64, STRIPES: 28 }

/**
 * The slice of the sound for one video frame at `timeSec`, as `columns` values: each column's
 * value is the sample of largest size in its share of the frame (keeping its sign). Past the end
 * of the samples the columns are 0.
 */
export function frameColumns(samples: ArrayLike<number>, sampleRate: number, timeSec: number, columns: number): number[] {
  const out = new Array<number>(Math.max(0, columns)).fill(0)
  if (!samples.length || !(sampleRate > 0) || columns < 1) return out
  const frameLen = Math.max(columns, Math.floor(sampleRate / WAVE_FPS))
  const start = Math.max(0, Math.floor(timeSec * sampleRate))
  const per = frameLen / columns
  for (let c = 0; c < columns; c++) {
    const from = start + Math.floor(c * per)
    const to = Math.min(samples.length, start + Math.max(Math.floor((c + 1) * per), Math.floor(c * per) + 1))
    let best = 0
    for (let i = from; i < to; i++) {
      const v = samples[i] ?? 0
      if (Math.abs(v) > Math.abs(best)) best = v
    }
    out[c] = Math.max(-1, Math.min(1, best))
  }
  return out
}

/** Height (in the 25-high sketch) of a mirrored bar for a column value, brightened the way the server's sqrt scale does. */
export function barHeight(value: number, max = 23): number {
  return Math.max(1.2, Math.min(max, Math.sqrt(Math.abs(value)) * max))
}

/** The time to show at `elapsedSec` of looping: runs over the kept seconds and starts again. */
export function loopTime(elapsedSec: number, lengthSec: number): number {
  if (!(lengthSec > 0)) return 0
  const t = elapsedSec % lengthSec
  return t < 0 ? t + lengthSec : t
}

/** Mono samples of the first `seconds` of decoded audio (channels averaged), or null when there is nothing to draw. */
export function firstSeconds(channels: ArrayLike<number>[], sampleRate: number, seconds = PREVIEW_SECONDS): Float32Array | null {
  const first = channels[0]
  if (!first || !first.length || !(sampleRate > 0)) return null
  const n = Math.min(first.length, Math.floor(seconds * sampleRate))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (const ch of channels) sum += ch[i] ?? 0
    out[i] = sum / channels.length
  }
  return out
}
