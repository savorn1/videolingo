// Client-side mirror of the backend's SubtitleQuality checks, so the editor can
// flag readability problems while typing. The server re-checks on save and
// its result (issues / issueCount) is authoritative — keep the two in step.

export interface SubtitleRules {
  maxCharsPerLine: number
  maxLines: number
  minDurationMs: number
  maxDurationMs: number
  /** Max characters per second (whitespace excluded). */
  maxCps: number
}

export type SubtitleIssueType = 'LINE_TOO_LONG' | 'TOO_MANY_LINES' | 'TOO_FAST' | 'TOO_SHORT' | 'TOO_LONG' | 'OVERLAP'

export interface SubtitleIssue {
  cueIndex: number
  type: SubtitleIssueType
  message: string
}

export const ISSUE_LABELS: Record<SubtitleIssueType, string> = {
  LINE_TOO_LONG: 'Line too long',
  TOO_MANY_LINES: 'Too many lines',
  TOO_FAST: 'Too fast to read',
  TOO_SHORT: 'Too brief',
  TOO_LONG: 'On screen too long',
  OVERLAP: 'Overlaps next'
}

// Code points, so an emoji or CJK character counts as one (matches Java's codePointCount).
function length(text: string): number {
  return [...text].length
}

export function readableLength(text: string): number {
  return [...text].filter((ch) => !/\s/.test(ch)).length
}

/** Characters per second, whitespace excluded; 0 for a zero-length cue. */
export function charsPerSecond(text: string, startMs: number, endMs: number): number {
  const duration = endMs - startMs
  return duration > 0 ? (readableLength(text) * 1000) / duration : 0
}

export function checkSubtitleCues(cues: { startMs: number; endMs: number; text: string }[], rules: SubtitleRules): SubtitleIssue[] {
  const issues: SubtitleIssue[] = []
  cues.forEach((c, i) => {
    const lines = c.text.split('\n')
    if (lines.length > rules.maxLines) issues.push({ cueIndex: i, type: 'TOO_MANY_LINES', message: `${lines.length} lines (max ${rules.maxLines})` })
    const longest = lines.map(length).reduce((a, b) => Math.max(a, b), 0)
    if (longest > rules.maxCharsPerLine)
      issues.push({ cueIndex: i, type: 'LINE_TOO_LONG', message: `Line has ${longest} characters (max ${rules.maxCharsPerLine})` })
    const duration = c.endMs - c.startMs
    if (duration > 0) {
      const cps = charsPerSecond(c.text, c.startMs, c.endMs)
      if (cps > rules.maxCps) issues.push({ cueIndex: i, type: 'TOO_FAST', message: `${cps.toFixed(1)} characters/second (max ${Math.round(rules.maxCps)})` })
    }
    if (duration < rules.minDurationMs) {
      issues.push({ cueIndex: i, type: 'TOO_SHORT', message: `On screen ${(duration / 1000).toFixed(1)}s (min ${(rules.minDurationMs / 1000).toFixed(1)}s)` })
    } else if (duration > rules.maxDurationMs) {
      issues.push({ cueIndex: i, type: 'TOO_LONG', message: `On screen ${(duration / 1000).toFixed(1)}s (max ${(rules.maxDurationMs / 1000).toFixed(1)}s)` })
    }
    const next = cues[i + 1]
    if (next && next.startMs < c.endMs) issues.push({ cueIndex: i, type: 'OVERLAP', message: 'Overlaps the next cue' })
  })
  return issues
}

/** The cue showing at `ms` (last one started and not yet ended), or -1. Cues must be sorted by start. */
export function activeCueIndex(cues: { startMs: number; endMs: number }[], ms: number): number {
  let found = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i]!.startMs > ms) break
    if (ms < cues[i]!.endMs) found = i
  }
  return found
}
