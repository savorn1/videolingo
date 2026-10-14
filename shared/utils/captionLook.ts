// A look of one's own for burned-in subtitles (backend CaptionRules.Look, over the CLASSIC / BOX / YELLOW / KARAOKE styles):
// text, second-line and outline/box colours, a box behind the text with its opacity, and bold. The server draws them
// in Noto Sans; the editor shows a sample line in the same colours.

export interface CaptionLook {
  color: string
  secondColor: string
  edgeColor: string
  box: boolean
  /** How solid the box is, 0–1 (only with `box`). */
  boxOpacity: number
  bold: boolean
}

/** The look a style has, as a starting point for customising it (the server's own colours for each style). */
export function captionLookFor(style: string): CaptionLook {
  if (style === 'YELLOW') return { color: '#ffff00', secondColor: '#ffffff', edgeColor: '#000000', box: false, boxOpacity: 0.5, bold: true }
  // Karaoke: each word fills from the second colour (not yet said) to the main one (gold) as it is said.
  if (style === 'KARAOKE') return { color: '#ffd700', secondColor: '#ffffff', edgeColor: '#000000', box: false, boxOpacity: 0.5, bold: true }
  if (style === 'BOX') return { color: '#ffffff', secondColor: '#ffff99', edgeColor: '#000000', box: true, boxOpacity: 0.5, bold: true }
  return { color: '#ffffff', secondColor: '#ffff99', edgeColor: '#000000', box: false, boxOpacity: 0.5, bold: true }
}

const HEX = /^#[0-9a-f]{6}$/i

/** Why the look can't be used (as the server will say), or null. */
export function captionLookProblem(l: CaptionLook | null | undefined): string | null {
  if (!l) return null
  if (![l.color, l.secondColor, l.edgeColor].every((c) => HEX.test(c))) return 'Subtitles: pick the colours'
  if (!(l.boxOpacity >= 0 && l.boxOpacity <= 1)) return "Subtitles: the box's opacity is between 0 and 100%"
  return null
}

/** CSS for a sample line in this look, `px` tall text (the outline drawn as a text shadow). */
export function captionSampleStyle(l: CaptionLook, px: number): Record<string, string> {
  const alpha = Math.round(l.boxOpacity * 255)
    .toString(16)
    .padStart(2, '0')
  return {
    color: l.color,
    fontWeight: l.bold ? '700' : '400',
    fontSize: `${px}px`,
    ...(l.box
      ? { backgroundColor: `${l.edgeColor}${alpha}`, padding: '0 0.3em' }
      : { textShadow: `0 0 2px ${l.edgeColor}, 0 0 2px ${l.edgeColor}, 0 0 2px ${l.edgeColor}` })
  }
}
