// Frames along the Trim tab's timeline (the film strip) and the text on a made thumbnail. Pure, so tested.

/** The moments to show in a strip of `count` frames: the middle of each equal slice of the video. */
export function filmstripTimes(durationMs: number, count: number): number[] {
  if (!(durationMs > 0) || !(count > 0)) return []
  const slice = durationMs / count
  return Array.from({ length: count }, (_, i) => Math.round(slice * (i + 0.5)))
}

/** The thumbnail's words in lines of about `maxChars`, at most `maxLines` (the last ends in … when cut). */
export function thumbnailLines(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  for (const w of words) {
    const last = lines.at(-1)
    if (last !== undefined && (last + ' ' + w).length <= maxChars) lines[lines.length - 1] = `${last} ${w}`
    else lines.push(w)
  }
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[.,;:!?]?$/, '')}…`
  return kept
}

/** The text's size on a thumbnail `height` px high: bigger for fewer lines. */
export function thumbnailFontPx(height: number, lines: number): number {
  return Math.round(height * (lines <= 1 ? 0.14 : lines === 2 ? 0.12 : 0.1))
}

/** The waveform's peaks (0–1) as `count` columns, each the loudest of its slice. */
export function peakColumns(peaks: number[], count: number): number[] {
  if (!peaks.length || count <= 0) return []
  return Array.from({ length: count }, (_, i) => {
    const from = Math.floor((i * peaks.length) / count)
    const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / count))
    return Math.max(...peaks.slice(from, to))
  })
}
