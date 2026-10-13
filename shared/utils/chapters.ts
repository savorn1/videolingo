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
