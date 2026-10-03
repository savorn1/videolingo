// Sound added to a trim: background music mixed in, or an uploaded file used
// instead of the video's own sound. Times are in ms on the trimmed result's own
// timeline. The backend re-checks it (AudioEditRules) when it renders the trim.

export type TrimAudioMode = 'MIX' | 'REPLACE'

export interface TrimAudioSettings {
  mode: TrimAudioMode
  key: string
  name: string
  /** Read in the browser before uploading; null when it couldn't tell. */
  durationMs: number | null
  /** MIX only: 0–2 (1 = the file as it is). */
  volume: number
  loop: boolean
  duck: boolean
  /** MIX only: where on the result the music starts. */
  startMs: number
}

export const MAX_TRIM_AUDIO_VOLUME = 2

export function newTrimAudio(file: { key: string; name: string; durationMs: number | null }, mode: TrimAudioMode = 'MIX'): TrimAudioSettings {
  return { mode, ...file, volume: 0.5, loop: true, duck: true, startMs: 0 }
}

/** The `audio` part of a trim request. */
export function trimAudioRequest(a: TrimAudioSettings | null) {
  if (!a) return null
  if (a.mode === 'REPLACE') return { replaceKey: a.key }
  return { music: { key: a.key, volume: a.volume, loop: a.loop, duck: a.duck, startMs: Math.max(0, Math.round(a.startMs)) } }
}

/** Null = fine; otherwise why this can't be rendered. `resultMs` is the length of the trimmed video. */
export function validateTrimAudio(a: TrimAudioSettings | null, resultMs: number): string | null {
  if (!a) return null
  if (!a.key) return 'Upload the audio file first'
  if (a.mode === 'MIX') {
    if (!Number.isFinite(a.volume) || a.volume < 0 || a.volume > MAX_TRIM_AUDIO_VOLUME) return `The music volume is 0–${MAX_TRIM_AUDIO_VOLUME * 100} %`
    if (!Number.isFinite(a.startMs) || a.startMs < 0) return "The music can't start before the video does"
    if (resultMs > 0 && a.startMs >= resultMs) return 'The music starts after the end of the trimmed video'
  }
  return null
}

/** One line for the trim summary. */
export function describeTrimAudio(a: TrimAudioSettings | null): string | null {
  if (!a) return null
  return a.mode === 'REPLACE' ? `with "${a.name}" instead of its sound` : `with "${a.name}" mixed in`
}
