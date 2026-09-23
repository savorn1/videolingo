// Starting readability rules for a new track, mirroring SubtitleRules.defaultsFor
// on the backend (CJK text uses shorter, slower lines).
import type { SubtitleRules } from './subtitleQuality'

// Keep these object literals multi-line: the auto-import scanner misreads a
// one-line `export const X = { a: 1, b: 2 }` (the commas look like extra
// declarations) and silently drops every export after it in the file.
export const DEFAULT_SUBTITLE_RULES: SubtitleRules = {
  maxCharsPerLine: 42,
  maxLines: 2,
  minDurationMs: 1000,
  maxDurationMs: 7000,
  maxCps: 17
}

export const CJK_SUBTITLE_RULES: SubtitleRules = {
  maxCharsPerLine: 16,
  maxLines: 2,
  minDurationMs: 1000,
  maxDurationMs: 7000,
  maxCps: 9
}

export function defaultSubtitleRules(language: string | null | undefined): SubtitleRules {
  const primary = (language ?? '').split('-')[0]!.toLowerCase()
  return { ...(primary === 'ja' || primary === 'zh' ? CJK_SUBTITLE_RULES : DEFAULT_SUBTITLE_RULES) }
}
