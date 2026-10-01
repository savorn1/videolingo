// How fast the page's own animations run (the waveform sketches, the render animation).
// A multiplier on their normal speed, kept per browser. People who ask their system for
// less motion still get none, whatever is chosen here.

export const ANIMATION_SPEEDS = [0.5, 1, 1.5, 2] as const
export type AnimationSpeed = (typeof ANIMATION_SPEEDS)[number]
export const DEFAULT_ANIMATION_SPEED: AnimationSpeed = 1

/** Whatever was stored, as one of the offered speeds (the normal one when it is anything else). */
export function sanitizeAnimationSpeed(raw: unknown): AnimationSpeed {
  const n = typeof raw === 'string' ? Number(raw) : raw
  return ANIMATION_SPEEDS.find((s) => s === n) ?? DEFAULT_ANIMATION_SPEED
}

/** "0.5×", "1×", "1.5×" */
export function formatAnimationSpeed(speed: number): string {
  return `${+speed.toFixed(2)}×`
}
