// "Add AI chapters as markers": the AI-made chapters of a video (an AI generation of type CHAPTERS) become chapter
// markers on its timeline, which learners see under Chapters and editors can then move or rename.

export interface AiChapter {
  startSeconds: number
  title: string
}

/** Within this of an existing chapter marker, an AI chapter is taken to be the same one. */
export const SAME_CHAPTER_MS = 1000

/** The chapters of the generation in `language` if there is one, else of the first; empty when there are none. */
export function pickAiChapters(
  generations: { type: string; outputLanguage: string; content: Record<string, unknown> }[],
  language: string | null
): AiChapter[] {
  const chapters = generations.filter((g) => g.type === 'CHAPTERS' && Array.isArray(g.content.chapters))
  const chosen = chapters.find((g) => g.outputLanguage === language) ?? chapters[0]
  return chosen ? (chosen.content.chapters as AiChapter[]) : []
}

/** The markers to add: one per AI chapter inside the video, not already a chapter marker there, in time order. */
export function aiChaptersToMarkers(
  chapters: AiChapter[],
  existing: { atMs: number; chapter: boolean }[],
  durationMs: number
): { atMs: number; label: string }[] {
  const taken = existing.filter((m) => m.chapter).map((m) => m.atMs)
  const out: { atMs: number; label: string }[] = []
  for (const c of [...chapters].sort((a, b) => a.startSeconds - b.startSeconds)) {
    const atMs = Math.max(0, Math.round(c.startSeconds * 1000))
    const label = (c.title ?? '').trim().slice(0, 200)
    if (!label || (durationMs > 0 && atMs >= durationMs)) continue
    if ([...taken, ...out.map((o) => o.atMs)].some((t) => Math.abs(t - atMs) < SAME_CHAPTER_MS)) continue
    out.push({ atMs, label })
  }
  return out
}
