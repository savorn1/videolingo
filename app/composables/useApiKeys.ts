// Wraps the backend's ApiKeyController (/api/admin/api-keys), module
// "api-keys". A key acts as the account that created it; admins see every key.

import type { ApiEnvelope } from '#shared/types'

export interface ApiKey {
  id: number
  name: string
  /** The visible start of the key, e.g. "vl_3fK9a2Qx". */
  prefix: string
  username: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  revokedBy: string | null
  active: boolean
}

export function useApiKeys() {
  const api = useApi()
  const base = '/api/admin/api-keys'

  async function list() {
    return (await api<ApiEnvelope<ApiKey[]>>(base)).data
  }

  /** The full key (`secret`) is only ever returned here. */
  async function create(name: string, expiresInDays: number | null) {
    return (await api<ApiEnvelope<{ key: ApiKey; secret: string }>>(base, { method: 'POST', body: { name, expiresInDays } })).data
  }

  async function revoke(id: number) {
    return (await api<ApiEnvelope<ApiKey>>(`${base}/${id}`, { method: 'DELETE' })).data
  }

  return { list, create, revoke }
}
