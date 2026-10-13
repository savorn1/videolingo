// Layers that move or change size over their time on screen (backend OverlayRules.Layer toX/toY/toScale): from
// (x, y) at their own size to (toX, toY) at toScale × it, evenly across their time.

export interface MovingLayer {
  x: number
  y: number
  startMs: number
  endMs: number | null
  toX?: number | null
  toY?: number | null
  toScale?: number | null
}

export const MIN_TO_SCALE = 0.25
export const MAX_TO_SCALE = 4

export function isMovingLayer(l: MovingLayer): boolean {
  return l.toX != null || l.toY != null || (l.toScale != null && l.toScale !== 1)
}

/** Where the layer is and how big (× its size) at `ms`; a layer that ends "at the end" ends at `durationMs`. */
export function layerAt(l: MovingLayer, ms: number, durationMs: number): { x: number; y: number; scale: number } {
  const end = l.endMs ?? durationMs
  const along = end > l.startMs ? Math.min(1, Math.max(0, (ms - l.startMs) / (end - l.startMs))) : 0
  const toX = l.toX ?? l.x
  const toY = l.toY ?? l.y
  const toScale = l.toScale ?? 1
  return { x: l.x + (toX - l.x) * along, y: l.y + (toY - l.y) * along, scale: 1 + (toScale - 1) * along }
}
