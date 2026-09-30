// Moving one item to a new position in a list — the arithmetic behind
// drag-to-reorder. Returns a new list; the input is left alone.

/** Moves the item at `from` so it ends up at index `to`. Out-of-range indexes, or no movement, give the list back unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const last = list.length - 1
  if (from < 0 || from > last || to < 0 || to > last || from === to) return list as T[]
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

/**
 * The index an item ends up at when it is dropped on the row `overIndex`, on the
 * upper or lower half of it. `from` is where it started (it leaves its old place
 * first, which shifts everything after it up by one).
 */
export function dropIndex(from: number, overIndex: number, half: 'before' | 'after'): number {
  const raw = half === 'before' ? overIndex : overIndex + 1
  return from < raw ? raw - 1 : raw
}
