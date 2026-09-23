// Wraps the backend's admin-only CustomRoleController
// (/api/admin/custom-roles/**). A CustomRole is a named bundle of per-module
// permission grants, assignable to a USER-role account (see useUsers'
// customRoleId) — ADMIN accounts never need one, they always bypass
// permission checks. See PermissionAuthorizationManager on the backend for
// exactly how a request's module/action are derived and checked.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'

export type PermissionAction = 'READ' | 'WRITE' | 'APPROVE'

export interface PermissionGrant {
  module: string
  action: PermissionAction
}

export interface CustomRole {
  id: number
  name: string
  description: string | null
  permissions: PermissionGrant[]
}

export interface CustomRoleFilter {
  name?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CustomRolePayload {
  name: string
  description?: string
  permissions: PermissionGrant[]
}

export function useCustomRoles() {
  const api = useApi()

  function list(filter: CustomRoleFilter = {}) {
    return api<PageEnvelope<CustomRole>>('/api/admin/custom-roles', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<CustomRole>>(`/api/admin/custom-roles/${id}`)
    return res.data
  }

  async function create(payload: CustomRolePayload) {
    const res = await api<ApiEnvelope<CustomRole>>('/api/admin/custom-roles', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: CustomRolePayload) {
    const res = await api<ApiEnvelope<CustomRole>>(`/api/admin/custom-roles/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function remove(id: number) {
    await api(`/api/admin/custom-roles/${id}`, { method: 'DELETE' })
  }

  return { list, get, create, update, remove }
}
