// Wraps the backend's ProcessingJobController (/api/admin/processing-jobs/**),
// gated as module "processing-jobs": GET = READ, retry/delete = WRITE,
// cancel = APPROVE.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { JobStatus, JobType } from '#shared/utils/processingJobs'

export interface ProcessingJob {
  id: number
  videoId: number
  /** Null if the video row no longer exists. */
  videoTitle: string | null
  type: JobType
  status: JobStatus
  /** 0–100 */
  progress: number
  currentStep: string | null
  /** Raw JSON string, e.g. {"targetLanguage":"en"}. */
  parameters: string | null
  attempts: number
  maxAttempts: number
  errorMessage: string | null
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
  updatedAt: string | null
  /** Start → finish (or → now while running); null if never started. */
  durationSeconds: number | null
  /** Only populated on the single-job response. */
  logCount: number
  canRetry: boolean
  canCancel: boolean
  canDelete: boolean
}

export interface ProcessingJobProgress {
  id: number
  status: JobStatus
  progress: number
  currentStep: string | null
  errorMessage: string | null
  durationSeconds: number | null
  updatedAt: string | null
  lastLogId: number | null
}

export interface ProcessingJobLog {
  id: number
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  createdAt: string
}

export interface ProcessingJobFilter {
  /** Job id (e.g. "42" or "#42") or part of the video title. */
  search?: string
  status?: JobStatus
  type?: JobType
  videoId?: number
  createdFrom?: string
  createdTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export function useProcessingJobs() {
  const api = useApi()
  const base = '/api/admin/processing-jobs'

  function list(filter: ProcessingJobFilter = {}) {
    return api<PageEnvelope<ProcessingJob>>(base, { query: filter })
  }

  async function summary() {
    return (await api<ApiEnvelope<Record<JobStatus, number>>>(`${base}/summary`)).data
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base}/${id}`)).data
  }

  async function progress(id: number) {
    return (await api<ApiEnvelope<ProcessingJobProgress>>(`${base}/${id}/progress`)).data
  }

  /** Lines with id > afterId, oldest first. */
  async function logs(id: number, afterId = 0, limit = 500) {
    return (await api<ApiEnvelope<ProcessingJobLog[]>>(`${base}/${id}/logs`, { query: { afterId, limit } })).data
  }

  async function retry(id: number) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base}/${id}/retry`, { method: 'POST' })).data
  }

  async function cancel(id: number) {
    return (await api<ApiEnvelope<ProcessingJob>>(`${base}/${id}/cancel`, { method: 'POST' })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  return { list, summary, get, progress, logs, retry, cancel, remove }
}
