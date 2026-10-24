// "Copy chapters for YouTube": a video's markers as the chapter list YouTube reads from a video's description —
// one "0:00 Intro" line each. YouTube shows them only when the first is at 0:00, there are at least three, and each
// lasts at least 10 s, so the list is made to fit that. Pure, so tested.

export const YT_MIN_CHAPTERS = 3
export const YT_MIN_CHAPTER_MS = 10_000

function stamp(ms: number, hours: boolean): string {
  const s = Math.floor(ms / 1000)
  const two = (n: number) => String(n).padStart(2, '0')
  return hours ? `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}` : `${Math.floor(s / 60)}:${two(s % 60)}`
}

/**
 * The chapter lines from the chapter markers (all markers when none is a chapter): the first moved to 0:00 when it is
 * within 10 s of the start (else an "Intro" at 0:00 comes first), and any closer than 10 s to the one before or to the
 * end left out. `problem` says why YouTube wouldn't show them, if it wouldn't.
 */
export function youtubeChapters(
  markers: { atMs: number; label: string; chapter: boolean }[],
  durationMs: number
): { text: string; count: number; skipped: number; problem: string | null } {
  const flagged = markers.filter((m) => m.chapter)
  const source = (flagged.length ? flagged : markers)
    .filter((m) => m.label.trim() && m.atMs >= 0 && (!durationMs || m.atMs < durationMs))
    .sort((a, b) => a.atMs - b.atMs)
  const kept: { atMs: number; label: string }[] = []
  for (const m of source) {
    const label = m.label.trim()
    if (!kept.length) {
      kept.push(m.atMs < YT_MIN_CHAPTER_MS ? { atMs: 0, label } : { atMs: 0, label: 'Intro' })
      if (m.atMs >= YT_MIN_CHAPTER_MS) kept.push({ atMs: m.atMs, label })
      continue
    }
    if (m.atMs - kept[kept.length - 1]!.atMs < YT_MIN_CHAPTER_MS) continue
    if (durationMs && durationMs - m.atMs < YT_MIN_CHAPTER_MS) continue
    kept.push({ atMs: m.atMs, label })
  }
  const added = kept.length && kept[0]!.label === 'Intro' && !source.some((m) => m.label.trim() === 'Intro' && m.atMs === 0) ? 1 : 0
  const hours = durationMs >= 3_600_000
  return {
    text: kept.map((c) => `${stamp(c.atMs, hours)} ${c.label}`).join('\n'),
    count: kept.length,
    skipped: source.length - (kept.length - added),
    problem:
      kept.length < YT_MIN_CHAPTERS
        ? `YouTube shows chapters only when there are at least ${YT_MIN_CHAPTERS}, each ${YT_MIN_CHAPTER_MS / 1000} s or longer — add more markers.`
        : null
  }
}
