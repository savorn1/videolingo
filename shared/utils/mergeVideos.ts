// Joining videos into one: the checks and small conversions the merge dialog does
// before anything is sent. The server checks again (MergeRules).

export const MIN_MERGE_VIDEOS = 2
export const MAX_MERGE_VIDEOS = 10
/** Re-encoding is slow, so the joined video is capped (the server enforces the same). */
export const MAX_MERGE_SECONDS = 3 * 60 * 60

export const MERGE_TRANSITIONS = [
  { value: 'NONE', label: 'Straight cut', hint: 'One video follows the next' },
  { value: 'FADE', label: 'Fade', hint: 'Dips through black between videos' },
  { value: 'FADE_WHITE', label: 'Fade to white', hint: 'Dips through white between videos' },
  { value: 'DISSOLVE', label: 'Dissolve', hint: 'One video melts into the next (the result is a little shorter)' },
  { value: 'WIPE', label: 'Wipe', hint: 'The next video wipes in from the right (the result is a little shorter)' },
  { value: 'SLIDE', label: 'Slide', hint: 'The next video slides in from the right (the result is a little shorter)' }
] as const
export type MergeTransition = (typeof MERGE_TRANSITIONS)[number]['value']

/** Dissolve, wipe and slide play the videos over each other at each joint, so the result is shorter than the sum. */
export const OVERLAP_SECONDS = 0.6
export function overlapsVideos(transition: MergeTransition): boolean {
  return transition === 'DISSOLVE' || transition === 'WIPE' || transition === 'SLIDE'
}

/** The length of the joined video: the videos' total, less the overlap at each joint of an overlapping transition (a short video holds a shorter one). */
export function joinedSeconds(durations: number[], transition: MergeTransition): number {
  const total = durations.reduce((a, b) => a + b, 0)
  if (!overlapsVideos(transition)) return total
  let overlap = 0
  for (let i = 1; i < durations.length; i++) overlap += Math.min(OVERLAP_SECONDS, Math.min(durations[i - 1]!, durations[i]!) / 2)
  return Math.max(0, total - overlap)
}

/** What the dialog needs to know about a video to be joined. */
export interface MergeItem {
  id: number
  title: string
  durationSeconds: number | null
  thumbnailUrl: string | null
  /** Why this one can't be joined, or null when it can. */
  blocked: string | null
}

/** Total of the lengths that are known, and how many videos have none recorded. */
export function mergeTotals(items: Pick<MergeItem, 'durationSeconds'>[]): { seconds: number; unknown: number } {
  let seconds = 0
  let unknown = 0
  for (const i of items) {
    if (i.durationSeconds && i.durationSeconds > 0) seconds += i.durationSeconds
    else unknown++
  }
  return { seconds, unknown }
}

/** A reason the chosen videos can't be joined yet, or null. */
export function mergeProblem(items: MergeItem[]): string | null {
  if (items.length < MIN_MERGE_VIDEOS) return `Pick at least ${MIN_MERGE_VIDEOS} videos`
  if (items.length > MAX_MERGE_VIDEOS) return `At most ${MAX_MERGE_VIDEOS} videos can be joined at once`
  const blocked = items.find((i) => i.blocked)
  if (blocked) return `“${blocked.title}” ${blocked.blocked}`
  if (mergeTotals(items).seconds > MAX_MERGE_SECONDS) return `The joined video would be over ${MAX_MERGE_SECONDS / 3600} hours long`
  return null
}

/** Why a video can't be joined, or null: it has to be a stored file that isn't in the trash. */
export function blockedReason(video: { deleted: boolean; storageKey?: string | null; source?: string | null }): string | null {
  if (video.deleted) return 'is in the trash'
  if (video.storageKey === null || video.source === 'YOUTUBE' || video.source === 'VIMEO' || video.source === 'FACEBOOK' || video.source === 'URL') {
    return 'is a link, not a stored file — import it first'
  }
  return null
}

/** "A + B", "A + B + C", or "A + 3 more"; kept within the 200-character title limit. */
export function defaultMergeTitle(titles: string[]): string {
  const clean = titles.map((t) => t.trim()).filter(Boolean)
  if (!clean.length) return ''
  const joined = clean.length <= 3 ? clean.join(' + ') : `${clean[0]} + ${clean.length - 1} more`
  return joined.length > 200 ? `${joined.slice(0, 199)}…` : joined
}

// ── The dialog's timeline ────────────────────────────────────────────────────

/** Where each video will start in the joined one, in seconds; null from the first video of unknown length onwards (nothing after it can be placed). */
export function mergeStarts(items: Pick<MergeItem, 'durationSeconds'>[]): (number | null)[] {
  const out: (number | null)[] = []
  let at: number | null = 0
  for (const item of items) {
    out.push(at)
    at = at !== null && item.durationSeconds && item.durationSeconds > 0 ? at + item.durationSeconds : null
  }
  return out
}

/** Each video's share of the joined length as percentages adding up to 100; one of unknown length counts as an average-sized one. */
export function mergeShares(items: Pick<MergeItem, 'durationSeconds'>[]): number[] {
  if (!items.length) return []
  const known = items.map((i) => (i.durationSeconds && i.durationSeconds > 0 ? i.durationSeconds : 0))
  const knownOnly = known.filter(Boolean)
  const average = knownOnly.length ? knownOnly.reduce((a, b) => a + b, 0) / knownOnly.length : 1
  const weights = known.map((k) => k || average)
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => (w / total) * 100)
}

/**
 * A cautious guess at how long the join takes to render: it is re-encoded, and a laptop
 * managed about 37 times faster than real time on a plain test video. Real footage,
 * a slower server and a bigger frame are allowed for.
 */
export function estimateMergeSeconds(totalSeconds: number, resolution: string): number {
  const perSecond = resolution === '1080p' ? 0.3 : resolution === '480p' || resolution === '360p' ? 0.08 : 0.13
  return Math.round(totalSeconds * perSecond)
}

/** "under a minute", "about 4 min", "about 1 h 20 min". */
export function describeEstimate(seconds: number): string {
  if (seconds < 60) return 'under a minute'
  const minutes = Math.round(seconds / 60)
  return minutes >= 60 ? `about ${Math.floor(minutes / 60)} h ${minutes % 60} min` : `about ${minutes} min`
}

/** The join settings worth remembering between uses of the dialog, made safe: anything not valid falls back to the default. */
export function sanitizeMergeLook(raw: unknown): { resolution: '360p' | '480p' | '720p' | '1080p'; transition: MergeTransition } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const resolutions = ['360p', '480p', '720p', '1080p'] as const
  return {
    resolution: resolutions.find((x) => x === r.resolution) ?? '720p',
    transition: MERGE_TRANSITIONS.find((t) => t.value === r.transition)?.value ?? 'NONE'
  }
}
