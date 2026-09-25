// Wraps the backend's GlossaryController (/api/admin/glossaries/**), gated as
// module "glossaries": GET = READ, the rest = WRITE. Enabled glossaries are
// followed by the translation pipeline and checked by the subtitle editor.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { GlossaryTermRule } from '#shared/utils/glossary'

export interface GlossaryTerm {
  id?: number
  source: string
  /** Equal to `source` when doNotTranslate. */
  target: string
  doNotTranslate: boolean
  caseSensitive: boolean
  note: string | null
}

export interface Glossary {
  id: number
  name: string
  /** Null = applies whatever language the text is translated from. */
  sourceLanguage: string | null
  targetLanguage: string
  description: string | null
  enabled: boolean
  termCount: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
  /** Detail only. */
  terms: GlossaryTerm[] | null
}

export interface GlossaryPayload {
  name: string
  sourceLanguage?: string | null
  targetLanguage: string
  description?: string | null
  enabled: boolean
  /** Replaces every term. */
  terms: Omit<GlossaryTerm, 'id'>[]
}

export interface GlossaryFilter {
  search?: string
  sourceLanguage?: string
  targetLanguage?: string
  enabled?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface ApplicableTerm extends GlossaryTermRule {
  glossaryId: number
  glossaryName: string
}

export function useGlossaries() {
  const api = useApi()
  const base = '/api/admin/glossaries'

  function list(filter: GlossaryFilter = {}) {
    return api<PageEnvelope<Glossary>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<Glossary>>(`${base}/${id}`)).data
  }

  async function create(payload: GlossaryPayload) {
    return (await api<ApiEnvelope<Glossary>>(base, { method: 'POST', body: payload })).data
  }

  async function update(id: number, payload: GlossaryPayload) {
    return (await api<ApiEnvelope<Glossary>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  /** Merged terms of every enabled glossary into `target` (from `source`, when known). */
  async function applicableTerms(target: string, source?: string | null) {
    return (await api<ApiEnvelope<ApplicableTerm[]>>(`${base}/terms`, { query: { target, source: source || undefined } })).data
  }

  return { list, get, create, update, remove, applicableTerms }
}
