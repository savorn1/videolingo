// The signed-in user's flashcards and quiz scores (/api/me/cards,
// /api/me/quiz-attempts). Cards are scheduled by spaced repetition on the
// server (learn/Srs).

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export type CardGrade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export interface StudyCard {
  id: number
  front: string
  back: string
  language: string | null
  context: string | null
  videoId: number | null
  atMs: number | null
  source: 'WORD' | 'KEY_POINT' | 'MANUAL'
  ease: number
  intervalDays: number
  repetitions: number
  lapses: number
  dueAt: string
  lastReviewedAt: string | null
  createdAt: string
}

export interface CardPayload {
  front: string
  back: string
  language?: string | null
  context?: string | null
  videoId?: number | null
  atMs?: number | null
}

export interface QuizAttemptSummary {
  id: number
  generationId: number
  videoId: number
  score: number
  total: number
  percent: number
  createdAt: string
}

export function useStudy() {
  const api = useApi()

  function cards(params: { search?: string; dueOnly?: boolean; page?: number; size?: number } = {}) {
    return api<PageEnvelope<StudyCard>>('/api/me/cards', { query: params })
  }

  async function stats() {
    return (await api<ApiEnvelope<{ total: number; due: number }>>('/api/me/cards/stats')).data
  }

  async function due(limit = 20) {
    return (await api<ApiEnvelope<StudyCard[]>>('/api/me/cards/due', { query: { limit } })).data
  }

  async function create(payload: CardPayload, source: StudyCard['source'] = 'WORD') {
    return (await api<ApiEnvelope<StudyCard>>('/api/me/cards', { method: 'POST', body: payload, query: { source } })).data
  }

  async function fromKeyPoints(generationId: number) {
    return (await api<ApiEnvelope<number>>('/api/me/cards/from-key-points', { method: 'POST', body: { generationId } })).data
  }

  async function update(id: number, payload: CardPayload) {
    return (await api<ApiEnvelope<StudyCard>>(`/api/me/cards/${id}`, { method: 'PUT', body: payload })).data
  }

  async function remove(id: number) {
    await api(`/api/me/cards/${id}`, { method: 'DELETE' })
  }

  async function review(id: number, grade: CardGrade) {
    return (await api<ApiEnvelope<StudyCard>>(`/api/me/cards/${id}/review`, { method: 'POST', body: { grade } })).data
  }

  async function quizAttempts(videoId?: number) {
    return (await api<ApiEnvelope<QuizAttemptSummary[]>>('/api/me/quiz-attempts', { query: { videoId } })).data
  }

  return { cards, stats, due, create, fromKeyPoints, update, remove, review, quizAttempts }
}
