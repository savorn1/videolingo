// Wraps the backend's AiController (/api/admin/ai/**, module "ai": GET = READ;
// generating, chatting and deleting = WRITE). Every call that reaches Claude
// is logged server-side with its tokens and cost (AI Usage/Cost Tracking).

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { AiFeature, AiTaskType } from '#shared/utils/ai'

export type AiUsageStatus = 'SUCCESS' | 'REFUSED' | 'TRUNCATED' | 'ERROR'

export interface AiUsage {
  id: number
  feature: AiFeature
  status: AiUsageStatus
  model: string | null
  /** Set when this call was the retry on the fallback model after a refusal. */
  fallbackFrom: string | null
  videoId: number | null
  transcriptId: number | null
  chatId: number | null
  username: string | null
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  /** Null when the model has no configured price. */
  costUsd: number | null
  latencyMs: number | null
  requestId: string | null
  stopReason: string | null
  errorMessage: string | null
  createdAt: string
}

export interface AiStatus {
  configured: boolean
  /** Settings › AI master switch. */
  enabled: boolean
  /** SUMMARY…CHAT → switched on in Settings. */
  features: Record<string, boolean>
  defaultCounts: Record<string, number>
  maxChatMessageChars: number
  model: string
  fallbackModel: string | null
  generationEffort: string
  chatEffort: string
  monthSpendUsd: number
  monthlyBudgetUsd: number | null
  budgetEnforced: boolean
  budgetExceeded: boolean
  pricing: Record<string, { inputPerMtok: number; outputPerMtok: number }>
}

// ── structured outputs (shape per type) ─────────────────────────────────

export interface SummaryContent {
  tldr: string
  summary: string
  topics: string[]
  estimatedLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null
}

export interface ChaptersContent {
  chapters: { startSeconds: number; title: string; summary: string }[]
}

export interface KeyPointsContent {
  keyPoints: { point: string; explanation: string; timestampSeconds: number }[]
}

export interface QuestionsContent {
  questions: { question: string; answer: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; timestampSeconds: number }[]
}

export interface QuizContent {
  questions: { question: string; options: string[]; correctOptionIndex: number; explanation: string; timestampSeconds: number }[]
}

export interface AiGeneration {
  id: number
  videoId: number
  transcriptId: number
  transcriptLanguage: string | null
  type: AiTaskType
  outputLanguage: string
  model: string | null
  content: Record<string, unknown>
  itemCount: number
  warnings: string[]
  createdBy: string | null
  createdAt: string
  usage: AiUsage | null
}

export interface AiGenerateRequest {
  type: AiTaskType
  transcriptId?: number
  outputLanguage?: string
  count?: number
}

// ── chat ────────────────────────────────────────────────────────────────

export interface AiChatMessage {
  id: number
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
  usage: AiUsage | null
}

export interface AiChat {
  id: number
  videoId: number
  videoTitle: string | null
  transcriptId: number
  transcriptLanguage: string | null
  title: string
  messageCount: number
  totalCostUsd: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Detail only (null in lists). */
  messages: AiChatMessage[] | null
}

export interface AiChatTurn {
  chat: AiChat
  userMessage: AiChatMessage
  assistantMessage: AiChatMessage
}

// ── usage / cost ────────────────────────────────────────────────────────

export interface AiUsageGroup {
  key: string
  requests: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  costUsd: number
}

export interface AiUsageSummary {
  from: string
  to: string
  requests: number
  errors: number
  refusals: number
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  costUsd: number
  avgCostPerRequestUsd: number
  avgLatencyMs: number | null
  cacheHitRate: number
  cacheSavingsUsd: number
  unpricedRequests: number
  byFeature: AiUsageGroup[]
  byModel: AiUsageGroup[]
  byUser: AiUsageGroup[]
  daily: { date: string; requests: number; costUsd: number }[]
}

export interface AiUsageFilter {
  feature?: AiFeature
  status?: AiUsageStatus
  model?: string
  videoId?: number
  username?: string
  from?: string
  to?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

/** Expected size and cost of a generation, before running it (AiEstimateService). */
export interface AiEstimate {
  type: string
  model: string
  inputTokens: number
  outputTokens: number
  /** Input size measured from an earlier call on this transcript (else estimated from its text). */
  inputMeasured: boolean
  /** Recent calls the output size is averaged from; 0 = a typical size was assumed. */
  outputSamples: number
  /** Null when the model has no configured price. */
  costUsd: number | null
  monthSpendUsd: number
  monthlyBudgetUsd: number | null
  budgetEnforced: boolean
  wouldExceedBudget: boolean
}

export function useAi() {
  const api = useApi()
  const base = '/api/admin/ai'

  async function status() {
    return (await api<ApiEnvelope<AiStatus>>(`${base}/status`)).data
  }

  /** Generate Summary / Chapters / Key Points / Questions / Quiz. Can take a minute. */
  async function generate(videoId: number, body: AiGenerateRequest) {
    return (await api<ApiEnvelope<AiGeneration>>(`${base}/videos/${videoId}/generate`, { method: 'POST', body, timeout: 600_000 })).data
  }

  async function estimate(videoId: number, params: { type: string; transcriptId?: number | null; count?: number | null }) {
    return (await api<ApiEnvelope<AiEstimate>>(`${base}/videos/${videoId}/estimate`, { query: params })).data
  }

  /** Newest result per (type, output language). */
  async function latest(videoId: number) {
    return (await api<ApiEnvelope<AiGeneration[]>>(`${base}/videos/${videoId}/generations`)).data
  }

  function history(videoId: number, type: AiTaskType, page = 1, size = 10) {
    return api<PageEnvelope<AiGeneration>>(`${base}/videos/${videoId}/generations/history`, { query: { type, page, size } })
  }

  async function removeGeneration(id: number) {
    await api(`${base}/generations/${id}`, { method: 'DELETE' })
  }

  async function chats(videoId: number) {
    return (await api<ApiEnvelope<AiChat[]>>(`${base}/chats`, { query: { videoId } })).data
  }

  async function createChat(videoId: number, transcriptId?: number) {
    return (await api<ApiEnvelope<AiChat>>(`${base}/chats`, { method: 'POST', body: { videoId, transcriptId } })).data
  }

  async function getChat(id: number) {
    return (await api<ApiEnvelope<AiChat>>(`${base}/chats/${id}`)).data
  }

  async function send(chatId: number, content: string) {
    return (await api<ApiEnvelope<AiChatTurn>>(`${base}/chats/${chatId}/messages`, { method: 'POST', body: { content }, timeout: 300_000 })).data
  }

  async function removeChat(id: number) {
    await api(`${base}/chats/${id}`, { method: 'DELETE' })
  }

  function usage(filter: AiUsageFilter = {}) {
    return api<PageEnvelope<AiUsage>>(`${base}/usage`, { query: filter })
  }

  async function usageSummary(from?: string, to?: string) {
    return (await api<ApiEnvelope<AiUsageSummary>>(`${base}/usage/summary`, { query: { from, to } })).data
  }

  return { status, generate, estimate, latest, history, removeGeneration, chats, createChat, getChat, send, removeChat, usage, usageSummary }
}
