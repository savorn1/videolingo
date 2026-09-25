// The learner side of the API (/api/learn/** — any signed-in account): only
// enabled videos, published subtitle tracks, public/unlisted collections and
// AI study material, with quiz answers kept back until a quiz is submitted.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { Collection, CollectionVideo } from './useCollections'
import type { Video, VideoFilter } from './useVideos'

export interface LearnTrack {
  id: number
  label: string
  language: string
  kind: 'SUBTITLES' | 'CAPTIONS'
  isDefault: boolean
}

export interface LearnVoiceOver {
  language: string
  languageName: string
  audioUrl: string
}

export interface WatchPage {
  video: Video
  /** Published tracks with cues; the default one first. */
  tracks: LearnTrack[]
  voiceOvers: LearnVoiceOver[]
}

export interface LearnCue {
  startMs: number
  endMs: number
  text: string
}

export type StudyType = 'SUMMARY' | 'CHAPTERS' | 'KEY_POINTS' | 'QUIZ'

export interface StudyItem {
  generationId: number
  type: StudyType
  outputLanguage: string
  /** Same shapes as AI Studio's results; QUIZ comes without answers. */
  content: Record<string, unknown>
  createdAt: string
}

export interface QuizQuestionResult {
  question: string
  options: string[]
  correctOptionIndex: number
  chosen: number | null
  correct: boolean
  explanation: string
  timestampSeconds: number
}

export interface QuizResult {
  attemptId: number
  generationId: number
  videoId: number
  score: number
  total: number
  percent: number
  /** 1 = first try at this quiz. */
  attemptNumber: number
  questions: QuizQuestionResult[]
  createdAt: string
}

export interface WordLookupResult {
  word: string
  language: string
  targetLanguage: string
  translation: string
  meaning: string | null
  partOfSpeech: string | null
  example: string | null
  /** glossary = your organisation's term; cache/ai = the AI dictionary. */
  source: 'glossary' | 'cache' | 'ai'
}

export function useLearn() {
  const api = useApi()
  const base = '/api/learn'

  function videos(filter: VideoFilter = {}) {
    return api<PageEnvelope<Video>>(`${base}/videos`, { query: filter })
  }

  async function watch(videoId: number) {
    return (await api<ApiEnvelope<WatchPage>>(`${base}/videos/${videoId}`)).data
  }

  async function study(videoId: number) {
    return (await api<ApiEnvelope<StudyItem[]>>(`${base}/videos/${videoId}/study`)).data
  }

  async function cues(subtitleId: number) {
    return (await api<ApiEnvelope<LearnCue[]>>(`${base}/subtitles/${subtitleId}/cues`)).data
  }

  function collections(params: { search?: string; page?: number; size?: number } = {}) {
    return api<PageEnvelope<Collection>>(`${base}/collections`, { query: params })
  }

  async function collection(id: number) {
    return (await api<ApiEnvelope<{ collection: Collection; videos: CollectionVideo[] }>>(`${base}/collections/${id}`)).data
  }

  async function submitQuiz(generationId: number, answers: (number | null)[]) {
    return (await api<ApiEnvelope<QuizResult>>(`${base}/quizzes/${generationId}/attempts`, { method: 'POST', body: { answers } })).data
  }

  async function lookup(params: { word: string; language: string; target: string; context?: string; videoId?: number }) {
    return (await api<ApiEnvelope<WordLookupResult>>(`${base}/lookup`, { query: params })).data
  }

  return { videos, watch, study, cues, collections, collection, submitQuiz, lookup }
}
