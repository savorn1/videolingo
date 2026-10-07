// The media tools' fixed rules as the server sends them (ClientSettingsController.MediaRules), checked
// against this app's own copies. The copies stay for inline checks; the server's list decides which
// waveform styles are offered, so a newer page on an older server never offers a style it can't draw.

import { MAX_STRIP, WAVEFORM_STYLES, type WaveformStyle } from './audioVideo'
import { MAX_AUDIO_CLIPS } from './audioEdit'
import { MAX_MERGE_SECONDS, MAX_MERGE_VIDEOS } from './mergeVideos'
import { MAX_SLIDES } from './slides'
import { MAX_QUEUED_EDITS, MAX_SEGMENTS } from './videoEdit'

export interface MediaRules {
  maxSegments: number
  maxQueuedEdits: number
  maxAudioClips: number
  maxMergeVideos: number
  maxMergeMs: number
  maxSlides: number
  maxStrip: number
  waveforms: string[]
}

/** This app's copies of the rules, in the server's shape. */
export const LOCAL_MEDIA_RULES: MediaRules = {
  maxSegments: MAX_SEGMENTS,
  maxQueuedEdits: MAX_QUEUED_EDITS,
  maxAudioClips: MAX_AUDIO_CLIPS,
  maxMergeVideos: MAX_MERGE_VIDEOS,
  maxMergeMs: MAX_MERGE_SECONDS * 1000,
  maxSlides: MAX_SLIDES,
  maxStrip: MAX_STRIP,
  waveforms: WAVEFORM_STYLES.map((w) => w.value)
}

/** Where the server's rules and this app's copies differ ("maxSegments: here 20, server 25"); empty when in step or unknown. */
export function mediaRulesDrift(server: Partial<MediaRules> | null | undefined, local: MediaRules = LOCAL_MEDIA_RULES): string[] {
  if (!server) return []
  const out: string[] = []
  for (const key of Object.keys(local) as (keyof MediaRules)[]) {
    const theirs = server[key]
    if (theirs === undefined) continue
    const mine = local[key]
    if (Array.isArray(mine)) {
      const t = Array.isArray(theirs) ? [...theirs].sort().join(',') : ''
      if ([...mine].sort().join(',') !== t) out.push(`${key}: here ${mine.join(', ')}; server ${Array.isArray(theirs) ? theirs.join(', ') : theirs}`)
    } else if (mine !== theirs) out.push(`${key}: here ${mine}, server ${theirs}`)
  }
  return out
}

/** The waveform styles to offer: those this app can draw that the server also lists (all of them when the server doesn't say). */
export function offeredWaveforms(server: readonly string[] | null | undefined): WaveformStyle[] {
  const all = WAVEFORM_STYLES.map((w) => w.value)
  if (!server?.length) return all
  return all.filter((w) => w === 'NONE' || server.includes(w))
}
