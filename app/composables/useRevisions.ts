// Version history shared by subtitle tracks and transcripts — the backend's
// RevisionService, reached through each resource's own /{id}/revisions
// endpoints (so they're gated by that resource's module permission).

import type { ApiEnvelope } from '#shared/types'

export interface RevisionSummary {
  id: number
  /** 1, 2, 3… per track/transcript; the highest is what's live. */
  number: number
  summary: string
  /** Cues or segments in this revision. */
  itemCount: number
  createdBy: string | null
  createdAt: string
}

export interface RevisionDetail<T> extends RevisionSummary {
  snapshot: T
}

export type RevisionResource = 'subtitles' | 'transcripts'

export function useRevisions<T>(resource: RevisionResource) {
  const api = useApi()
  const base = (id: number) => `/api/admin/${resource}/${id}/revisions`

  async function history(id: number) {
    return (await api<ApiEnvelope<RevisionSummary[]>>(base(id))).data
  }

  async function get(id: number, revisionId: number) {
    return (await api<ApiEnvelope<RevisionDetail<T>>>(`${base(id)}/${revisionId}`)).data
  }

  /** Brings the revision back as a new save; `version` guards against edits made since the page loaded. */
  async function restore<R>(id: number, revisionId: number, version?: number) {
    return (await api<ApiEnvelope<R>>(`${base(id)}/${revisionId}/restore`, { method: 'POST', query: { version } })).data
  }

  return { history, get, restore }
}
