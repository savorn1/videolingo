// Before / after on the editor's preview: the picture as it is on the left of a divider, with the look applied
// on the right (the preview's own CSS filter), so a look can be judged before rendering.

/** Where a picture of mediaW × mediaH sits inside a box of boxW × boxH when fitted whole (object-fit: contain). */
export function containRect(boxW: number, boxH: number, mediaW: number, mediaH: number): { x: number; y: number; w: number; h: number } {
  if (!(boxW > 0 && boxH > 0 && mediaW > 0 && mediaH > 0)) return { x: 0, y: 0, w: boxW, h: boxH }
  const scale = Math.min(boxW / mediaW, boxH / mediaH)
  const w = mediaW * scale
  const h = mediaH * scale
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

/** The divider's place (0–1) under the pointer, kept a little inside the edges so it can always be grabbed. */
export function dividerAt(clientX: number, left: number, width: number): number {
  if (!(width > 0)) return 0.5
  return Math.min(0.98, Math.max(0.02, (clientX - left) / width))
}
