// J / K / L in the editor, as in video editors: L plays, and each further press plays faster; J slows down again,
// and when already at normal speed (or paused) jumps back; K pauses and returns to normal speed. The browser
// can't play backwards smoothly, so J never plays in reverse.

export const SHUTTLE_RATES = [1, 1.5, 2, 4] as const

export type ShuttleAction = { play: boolean; rate: number } | { skipSeconds: number }

export function shuttleKey(key: 'J' | 'K' | 'L', s: { playing: boolean; rate: number }, skipSeconds = 10): ShuttleAction {
  if (key === 'K') return { play: false, rate: 1 }
  if (key === 'L') {
    if (!s.playing) return { play: true, rate: 1 }
    // The next step up (from a speed picked between steps too); 4× stays 4×.
    return { play: true, rate: SHUTTLE_RATES.find((r) => r > s.rate + 1e-6) ?? SHUTTLE_RATES[SHUTTLE_RATES.length - 1]! }
  }
  // J: slower while fast, else back.
  if (s.playing && s.rate > 1) return { play: true, rate: [...SHUTTLE_RATES].reverse().find((r) => r < s.rate) ?? 1 }
  return { skipSeconds: -skipSeconds }
}
