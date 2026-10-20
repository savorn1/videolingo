// Pure so the ratio/quality edge cases can be tested without mounting a page.
// "1920×1080 · 16:9 · 1080p" — the pieces of a resolution a person scans for.
export function describeResolution(width: number | null, height: number | null): { size: string; aspect: string | null; quality: string | null } | null {
  if (!width || !height) return null
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const d = gcd(width, height)
  const rw = width / d
  const rh = height / d
  // A small exact ratio (16:9, 4:3, 9:16…) as it is; otherwise the familiar one it's sold as, within 2 % (1366×768 is
  // "16:9", 2560×1080 "21:9"), and none for an odd shape rather than 683:384.
  const aspect = rw <= 32 && rh <= 32 ? `${rw}:${rh}` : nearestRatio(width / height)
  const short = Math.min(width, height)
  const quality = short >= 2160 ? '4K' : short >= 1440 ? '1440p' : short >= 1080 ? '1080p' : short >= 720 ? '720p' : short >= 480 ? '480p' : `${short}p`
  return { size: `${width}×${height}`, aspect, quality }
}

const FAMILIAR_RATIOS: [number, number][] = [
  [16, 9],
  [9, 16],
  [4, 3],
  [3, 4],
  [1, 1],
  [21, 9],
  [9, 21],
  [3, 2],
  [2, 3],
  [5, 4],
  [4, 5]
]

/** The familiar ratio within 2 % of `ratio` (width ÷ height), as "16:9"; null when none is that close. */
export function nearestRatio(ratio: number): string | null {
  let best: string | null = null
  let bestOff = 0.02
  for (const [w, h] of FAMILIAR_RATIOS) {
    const off = Math.abs(ratio / (w / h) - 1)
    if (off <= bestOff) {
      bestOff = off
      best = `${w}:${h}`
    }
  }
  return best
}
