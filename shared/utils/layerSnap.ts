// Snapping a dragged overlay layer to the frame's centre or to another
// layer's edge/centre (OverlayLayers.vue). One axis at a time — the caller
// runs it once for x, once for y. All values are fractions of the picture
// (0–1), matching EditorLayer's own x/y/width units.

export const SNAP_TOLERANCE = 0.015

export interface SnapResult {
  /** The snapped centre position for this axis — unchanged from `raw` when nothing was close enough. */
  value: number
  /** Where to draw the guide line, or null when nothing snapped. */
  guide: number | null
}

/**
 * The closest of "my centre to a centre" or "my edge to an edge" within
 * `tolerance`, else `raw` unchanged. `half` is the dragged layer's own
 * half-width (or half-height) in the same fraction units.
 */
export function snapAxis(raw: number, half: number, centers: number[], edges: number[], tolerance = SNAP_TOLERANCE): SnapResult {
  const candidates: { value: number; guide: number; dist: number }[] = []
  for (const c of centers) candidates.push({ value: c, guide: c, dist: Math.abs(raw - c) })
  for (const e of edges) {
    candidates.push({ value: e + half, guide: e, dist: Math.abs(raw - half - e) }) // my left/top edge to e
    candidates.push({ value: e - half, guide: e, dist: Math.abs(raw + half - e) }) // my right/bottom edge to e
  }
  const best = candidates.filter((c) => c.dist < tolerance).sort((a, b) => a.dist - b.dist)[0]
  return best ? { value: best.value, guide: best.guide } : { value: raw, guide: null }
}
