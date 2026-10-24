// Chapters learners jump between on the watch page (markers an editor flagged as chapters; backend ChapterRules).

export interface Chapter {
  atMs: number
  label: string
}

/** The chapter playing at `ms` (the last one started), or -1 before the first. Chapters are in time order. */
export function currentChapterIndex(chapters: Chapter[], ms: number): number {
  let index = -1
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i]!.atMs <= ms) index = i
    else break
  }
  return index
}

/** Where "next chapter" goes from `ms`, or null after the last. */
export function nextChapterStart(chapters: Chapter[], ms: number): number | null {
  return chapters.find((c) => c.atMs > ms + 250)?.atMs ?? null
}

/** Where "previous chapter" goes: the start of this chapter, or of the one before when just after its start (2 s). */
export function previousChapterStart(chapters: Chapter[], ms: number): number | null {
  const i = currentChapterIndex(chapters, ms)
  if (i < 0) return null
  if (ms - chapters[i]!.atMs > 2000) return chapters[i]!.atMs
  return i > 0 ? chapters[i - 1]!.atMs : chapters[i]!.atMs
}

/** How long a chapter's title stays on the picture in the editor's "Chapter titles" (ms). */
export const CHAPTER_TITLE_MS = 4000

/**
 * When each chapter's title shows, as text layers: from its start for `showMs`, cut short by the next chapter or the
 * video's end. Chapter markers when there are any, else every marker; untitled ones and ones too short (under 0.5 s)
 * are left out.
 */
export function chapterTitleSpans(
  markers: { atMs: number; label: string; chapter: boolean }[],
  durationMs: number,
  showMs = CHAPTER_TITLE_MS
): { startMs: number; endMs: number; text: string }[] {
  const flagged = markers.filter((m) => m.chapter)
  const marks = (flagged.length ? flagged : markers).filter((m) => m.label.trim() && m.atMs >= 0).sort((a, b) => a.atMs - b.atMs)
  return marks
    .map((m, i) => ({
      startMs: m.atMs,
      endMs: Math.min(m.atMs + showMs, marks[i + 1]?.atMs ?? Infinity, durationMs || Infinity),
      text: m.label.trim()
    }))
    .filter((s) => s.endMs - s.startMs >= 500)
}
