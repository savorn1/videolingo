// Joining videos into one: the checks and small conversions the merge dialog does
// before anything is sent. The server checks again (MergeRules).

export const MIN_MERGE_VIDEOS = 2
export const MAX_MERGE_VIDEOS = 10
/** Re-encoding is slow, so the joined video is capped (the server enforces the same). */
export const MAX_MERGE_SECONDS = 3 * 60 * 60

export const MERGE_TRANSITIONS = [
  { value: 'NONE', label: 'Straight cut', hint: 'One video follows the next' },
  { value: 'FADE', label: 'Fade', hint: 'Dips through black between videos' }
] as const
export type MergeTransition = (typeof MERGE_TRANSITIONS)[number]['value']

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
