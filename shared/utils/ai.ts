// Display helpers for the AI features (generation cards, chat, usage/cost dashboard).

export type AiTaskType = 'SUMMARY' | 'CHAPTERS' | 'KEY_POINTS' | 'QUESTIONS' | 'QUIZ'
export type AiFeature = AiTaskType | 'CHAT'

export interface AiTaskMeta {
  value: AiTaskType
  label: string
  icon: string
  description: string
  /** Default item count sent when the user doesn't pick one (null = not countable). */
  defaultCount: number | null
}

export const AI_TASKS: AiTaskMeta[] = [
  {
    value: 'SUMMARY',
    label: 'Summary',
    icon: 'i-lucide-file-text',
    description: 'One-line TL;DR, a short summary, topics and an estimated CEFR level.',
    defaultCount: null
  },
  {
    value: 'CHAPTERS',
    label: 'Chapters',
    icon: 'i-lucide-list-video',
    description: 'Timestamped sections wherever the topic changes.',
    defaultCount: null
  },
  {
    value: 'KEY_POINTS',
    label: 'Key points',
    icon: 'i-lucide-list-checks',
    description: 'The ideas and phrases a learner should take away.',
    defaultCount: 6
  },
  {
    value: 'QUESTIONS',
    label: 'Questions',
    icon: 'i-lucide-message-circle-question',
    description: 'Open comprehension questions with model answers.',
    defaultCount: 5
  },
  {
    value: 'QUIZ',
    label: 'Quiz',
    icon: 'i-lucide-circle-check-big',
    description: 'Multiple-choice questions with explanations.',
    defaultCount: 8
  }
]

export function aiFeatureLabel(feature: string | null | undefined): string {
  if (!feature) return '—'
  if (feature === 'CHAT') return 'Chat'
  if (feature === 'TRANSLATION') return 'Translation'
  if (feature === 'LOOKUP') return 'Word lookup'
  return AI_TASKS.find((t) => t.value === feature)?.label ?? feature
}

export function aiFeatureIcon(feature: string | null | undefined): string {
  if (feature === 'CHAT') return 'i-lucide-messages-square'
  if (feature === 'LOOKUP') return 'i-lucide-book-open-text'
  return AI_TASKS.find((t) => t.value === feature)?.icon ?? 'i-lucide-sparkles'
}

// Per-call AI costs are fractions of a cent, so a fixed 2 decimals would show
// "$0.00" for everything: small amounts keep 4 significant decimals instead.
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0.00'
  const abs = Math.abs(value)
  if (abs >= 1) return `$${value.toFixed(2)}`
  if (abs >= 0.01) return `$${value.toFixed(3)}`
  if (abs < 0.0001) return value < 0 ? '−<$0.0001' : '<$0.0001'
  return `$${value.toFixed(4)}`
}

// Token counts: "950", "12.3K", "4.1M".
export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (value < 1000) return String(Math.round(value))
  if (value < 1_000_000) return `${trimZero((value / 1000).toFixed(1))}K`
  return `${trimZero((value / 1_000_000).toFixed(1))}M`
}

function trimZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—'
  return `${Math.round(ratio * 100)}%`
}

// Summary text arrives as paragraphs separated by blank lines.
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// Chart axis top: the smallest 1/2/2.5/5 × 10^n at or above `max`, so gridlines
// land on round values ($0.05, $0.10, …) instead of the raw maximum.
export function niceCeil(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1
  const exp = Math.floor(Math.log10(max))
  const base = 10 ** exp
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * base
    if (candidate >= max - base * 1e-9) return Number(candidate.toPrecision(12))
  }
  return 10 * base
}
