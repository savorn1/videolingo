// Queue logic for playing a collection like a playlist. Positions are
// indexes into the collection's items; `order` is the play order (the
// collection order, or a shuffle of it) and only holds playable items.

export type RepeatMode = 'off' | 'all' | 'one'

/** Fisher–Yates shuffle of 0..n-1 (playable ones only), with `first` kept at the front. */
export function shuffledOrder(playable: number[], first: number | null, random: () => number = Math.random): number[] {
  const rest = playable.filter((i) => i !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
  }
  return first !== null && playable.includes(first) ? [first, ...rest] : rest
}

/**
 * What plays after `current` (null = stop). `auto` is true when the video
 * simply ended: repeat-one replays it then, but pressing Next still moves on.
 */
export function nextIndex(order: number[], current: number, repeat: RepeatMode, auto: boolean): number | null {
  if (!order.length) return null
  if (auto && repeat === 'one') return current
  const at = order.indexOf(current)
  if (at < 0) return order[0]!
  if (at + 1 < order.length) return order[at + 1]!
  return repeat === 'off' ? null : order[0]!
}

/** What Previous goes to (null = nothing before it). */
export function previousIndex(order: number[], current: number, repeat: RepeatMode): number | null {
  if (!order.length) return null
  const at = order.indexOf(current)
  if (at > 0) return order[at - 1]!
  return repeat === 'off' ? null : order[order.length - 1]!
}
