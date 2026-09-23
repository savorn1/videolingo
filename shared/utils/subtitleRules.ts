// Starting readability rules for a new track — Settings › Translation on the
// backend (compact scripts such as Japanese/Chinese use shorter, slower lines).
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

// Replaced at runtime by Settings › Translation (see plugins/settings.client.ts);
// the constants above are the fallback until that loads.
let standard: SubtitleRules = DEFAULT_SUBTITLE_RULES
let compact: SubtitleRules = CJK_SUBTITLE_RULES
let compactLanguages: string[] = ['ja', 'zh']

export function setSubtitleRuleDefaults(next: { standardRules: SubtitleRules; compactRules: SubtitleRules; compactLanguages: string[] }) {
  standard = { ...next.standardRules }
  compact = { ...next.compactRules }
  compactLanguages = next.compactLanguages.map((c) => c.toLowerCase())
}

export function defaultSubtitleRules(language: string | null | undefined): SubtitleRules {
  const primary = (language ?? '').split('-')[0]!.toLowerCase()
  return { ...(compactLanguages.includes(primary) ? compact : standard) }
}
