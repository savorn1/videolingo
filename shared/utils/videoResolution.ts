// Pure so the ratio/quality edge cases can be tested without mounting a page.
// "1920×1080 · 16:9 · 1080p" — the pieces of a resolution a person scans for.
export function describeResolution(width: number | null, height: number | null): { size: string; aspect: string | null; quality: string | null } | null {
  if (!width || !height) return null
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const d = gcd(width, height)
  const rw = width / d
  const rh = height / d
  // Only show a ratio when it's a recognisable one (16:9, 4:3, 9:16…), not 683:384.
  const aspect = rw <= 32 && rh <= 32 ? `${rw}:${rh}` : null
  const short = Math.min(width, height)
  const quality = short >= 2160 ? '4K' : short >= 1440 ? '1440p' : short >= 1080 ? '1080p' : short >= 720 ? '720p' : short >= 480 ? '480p' : `${short}p`
  return { size: `${width}×${height}`, aspect, quality }
}
