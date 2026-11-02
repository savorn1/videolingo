// Edit results — what a finished edit job made, kept until promoted, discarded or expired — named the same way in
// the editor's Results and on the Edit results page (every video's results at once).
import { formatDuration, serverTimeMs } from './format'

export type ResultOperation = 'TRIM' | 'SPLIT' | 'AUDIO' | 'EXTRACT' | 'OVERLAY' | 'SAMPLE'

export const CLIP_OPERATION_ICONS: Record<ResultOperation, string> = {
  TRIM: 'i-lucide-scissors',
  SPLIT: 'i-lucide-split',
  AUDIO: 'i-lucide-audio-lines',
  EXTRACT: 'i-lucide-file-audio',
  OVERLAY: 'i-lucide-layers',
  SAMPLE: 'i-lucide-flask-conical'
}

/** Results that can only be looked at or downloaded, never made into a video: extracted audio and test renders. */
export function downloadOnly(operation: ResultOperation): boolean {
  return operation === 'EXTRACT' || operation === 'SAMPLE'
}

/** A result this close to its expiry is flagged, so it gets kept or discarded before it's gone (results last 72 h). */
export const EXPIRES_SOON_MS = 12 * 60 * 60 * 1000

/** True when a result expires within EXPIRES_SOON_MS (or is already past it). */
export function expiresSoon(expiresAt: string | null | undefined, now = Date.now()): boolean {
  const at = serverTimeMs(expiresAt)
  return at != null && at - now < EXPIRES_SOON_MS
}

const short = (ms: number) => formatDuration(Math.round(ms / 1000))

/** "Trim · 0:05 – 0:30", "Segment 2 · 1:00 – end", "Video with new audio"… */
export function clipLabel(clip: {
  operation: ResultOperation
  segmentIndex: number | null
  startMs: number
  endMs: number | null
  label?: string | null
}): string {
  const span = `${short(clip.startMs)}${clip.endMs != null ? ` – ${short(clip.endMs)}` : ' – end'}`
  switch (clip.operation) {
    case 'SPLIT':
      return `Segment ${(clip.segmentIndex ?? 0) + 1}${clip.label ? ` · ${clip.label}` : ''} · ${span}`
    case 'AUDIO':
      return 'Video with new audio'
    case 'EXTRACT':
      return 'Extracted audio'
    case 'OVERLAY':
      return 'Text & overlay'
    case 'SAMPLE':
      return `Test render · ${span}`
    default:
      return `Trim · ${span}`
  }
}

/** Results that can become new videos in bulk: not a sound file to download, and from a video not in the trash. */
export function promotableAsNew<T extends { videoDeleted: boolean; clip: { operation: ResultOperation } }>(rows: T[]): T[] {
  return rows.filter((r) => !r.videoDeleted && !downloadOnly(r.clip.operation))
}
