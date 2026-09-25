// Wraps the backend's AuditLogController (/api/admin/audit-logs), module
// "audit-logs" (READ). One row per change-making request — see AuditPolicy.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export interface AuditEntry {
  id: number
  createdAt: string
  username: string | null
  /** "session", "api-key", or null when nobody was signed in. */
  authType: string | null
  method: string
  path: string
  module: string
  action: string | null
  entityId: number | null
  status: number
  durationMs: number
  ipAddress: string | null
  userAgent: string | null
  detail: string | null
}

export interface AuditFilter {
  username?: string
  module?: string
  method?: string
  outcome?: 'success' | 'failed' | 'denied'
  entityId?: number
  search?: string
  /** yyyy-mm-dd, inclusive. */
  from?: string
  to?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export function useAuditLogs() {
  const api = useApi()
  const base = '/api/admin/audit-logs'

  function list(filter: AuditFilter = {}) {
    return api<PageEnvelope<AuditEntry>>(base, { query: filter })
  }

  async function modules() {
    return (await api<ApiEnvelope<string[]>>(`${base}/modules`)).data
  }

  return { list, modules }
}
