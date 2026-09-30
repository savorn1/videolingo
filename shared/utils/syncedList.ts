// Small lists kept in the browser and on the server (export presets): the two
// copies made into one when they meet.

interface WithId {
  id: string
}

/**
 * `preferred` first, then anything in `other` it doesn't already have (matched by id), capped at `limit`.
 * The preferred copy wins when both hold the same id, so an edit made on the server is not undone by an old local copy.
 */
export function mergeById<T extends WithId>(preferred: T[], other: T[], limit = 30): T[] {
  const seen = new Set(preferred.map((e) => e.id))
  return [...preferred, ...other.filter((e) => !seen.has(e.id))].slice(0, limit)
}

export function sameIds<T extends WithId>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i]!.id)
}
