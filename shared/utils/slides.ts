// A slideshow over the audio: pictures with the time each one appears. The
// times belong to the list (row 1 starts at 0:00, later rows later still);
// the pictures are what fill them. The server checks the same rules.

export const MAX_SLIDES = 30
/** Pictures closer together than this would flash by. */
export const MIN_SLIDE_MS = 1000
/** A new picture is put this long after the one before it, until moved. */
export const DEFAULT_SLIDE_GAP_MS = 30_000

/** A problem with these start times (ms, in list order), or null when they are fine. */
export function slideProblem(starts: number[]): string | null {
  if (starts.length > MAX_SLIDES) return `At most ${MAX_SLIDES} pictures`
  if (starts.length && starts[0] !== 0) return 'The first picture starts at 0:00'
  for (let i = 1; i < starts.length; i++) {
    if (starts[i]! - starts[i - 1]! < MIN_SLIDE_MS) return `Picture ${i + 1} must start at least ${MIN_SLIDE_MS / 1000} second after picture ${i}`
  }
  return null
}

/** How many of these start times fall after the sound ends (in the last half second counts as after), and so would never be seen. */
export function slidesBeyond(starts: number[], durationSeconds: number | null): number {
  if (!durationSeconds) return 0
  const end = durationSeconds * 1000 - 500
  return starts.filter((s, i) => i > 0 && s >= end).length
}

/** Start times (ms) that spread `count` pictures evenly over the sound, on whole seconds; null when the sound is too short for that many. */
export function spreadEvenly(count: number, durationSeconds: number): number[] | null {
  if (count < 1 || durationSeconds < count * (MIN_SLIDE_MS / 1000)) return null
  const step = durationSeconds / count
  return Array.from({ length: count }, (_, i) => Math.round(i * step) * 1000)
}

/** Where the next picture should start when added: after the last one, but not past the end of a known sound. */
export function nextSlideStart(starts: number[], durationSeconds: number | null): number {
  if (!starts.length) return 0
  const wanted = starts[starts.length - 1]! + DEFAULT_SLIDE_GAP_MS
  if (!durationSeconds) return wanted
  // Room left: put it halfway through what remains, so it is at least seen.
  const end = durationSeconds * 1000
  return wanted < end - 1000 ? wanted : Math.max(starts[starts.length - 1]! + MIN_SLIDE_MS, Math.round((starts[starts.length - 1]! + end) / 2 / 1000) * 1000)
}

/** The index of the picture showing at `ms`: the last one that has started. */
export function slideIndexAt(starts: number[], ms: number): number {
  let index = 0
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= ms) index = i
  return index
}

/** Swaps what two rows hold while leaving their times where they are; a move off either end changes nothing. */
export function swapContents<T extends { startMs: number }>(rows: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= rows.length || b >= rows.length || a === b) return rows
  const next = rows.map((r) => ({ ...r }))
  const keep = next.map((r) => r.startMs)
  ;[next[a], next[b]] = [next[b]!, next[a]!]
  return next.map((r, i) => ({ ...r, startMs: keep[i]! }))
}
