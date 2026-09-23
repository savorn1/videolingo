// Wraps the backend's UserController (/api/admin/users/**). Single-item
// endpoints wrap their payload in ApiResponse<T>; list wraps in PageResponse<T>.
// Access is gated per module by PermissionAuthorizationManager — ADMIN always
// passes, a USER needs a custom role granting `users` READ/WRITE.

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { PermissionGrant } from './useCustomRoles'

export type Role = 'ADMIN' | 'USER'

export interface AdminUser {
  id: number
  username: string
  email: string | null
  role: Role
  enabled: boolean
  customRoleId: number | null
  customRoleName: string | null
  createdAt: string | null
  lastLoginAt: string | null
  // Only populated on single-user responses (get/create/update/etc), not
  // the batch list — see UserServiceImpl.effectivePermissionsOf.
  permissions?: PermissionGrant[]
}

export interface UserFilter {
  /** Case-insensitive match on username or email. */
  search?: string
  role?: Role
  enabled?: boolean
  customRoleId?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface CreateUserPayload {
  username: string
  password: string
  email?: string
  role: Role
  enabled: boolean
  // Only meaningful when role is USER — see PermissionAuthorizationManager.
  customRoleId?: number
}

/** Everything the Edit form covers — split across several endpoints by applyEdits(). */
export interface UserEditPayload {
  email?: string
  role: Role
  customRoleId?: number
  enabled: boolean
}

export function useUsers() {
  const api = useApi()

  function list(filter: UserFilter = {}) {
    return api<PageEnvelope<AdminUser>>('/api/admin/users', { query: filter })
  }

  async function get(id: number) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}`)
    return res.data
  }

  async function create(payload: CreateUserPayload) {
    const res = await api<ApiEnvelope<AdminUser>>('/api/admin/users', { method: 'POST', body: payload })
    return res.data
  }

  async function update(id: number, payload: { email?: string }) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}`, { method: 'PUT', body: payload })
    return res.data
  }

  async function updateRole(id: number, role: Role) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}/role`, { method: 'PUT', body: { role } })
    return res.data
  }

  async function updateCustomRole(id: number, customRoleId: number | undefined) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}/custom-role`, { method: 'PUT', body: { customRoleId } })
    return res.data
  }

  // Disabling also revokes the user's sessions server-side.
  async function updateStatus(id: number, enabled: boolean) {
    const res = await api<ApiEnvelope<AdminUser>>(`/api/admin/users/${id}/status`, { method: 'PUT', body: { enabled } })
    return res.data
  }

  async function resetPassword(id: number, newPassword: string) {
    await api(`/api/admin/users/${id}/password`, { method: 'PUT', body: { newPassword } })
  }

  async function remove(id: number) {
    await api(`/api/admin/users/${id}`, { method: 'DELETE' })
  }

  // Revokes the user's refresh tokens without touching role/status/password —
  // their current access token stays valid until it expires, but the next
  // refresh attempt fails and forces a re-login.
  async function forceLogout(id: number) {
    await api(`/api/admin/users/${id}/force-logout`, { method: 'POST' })
  }

  async function bulkForceLogout(userIds: number[]) {
    await api('/api/admin/users/force-logout', { method: 'POST', body: { userIds } })
  }

  // The Edit form is one form, but the backend splits it: role, custom role and
  // status each have their own endpoint because changing them revokes the
  // user's sessions. Only the parts that actually changed are sent, so saving
  // an email edit doesn't log the user out.
  async function applyEdits(row: AdminUser, payload: UserEditPayload) {
    let result = row
    if ((payload.email ?? '') !== (row.email ?? '')) result = await update(row.id, { email: payload.email || undefined })
    if (payload.role !== row.role) result = await updateRole(row.id, payload.role)
    if (payload.customRoleId !== (row.customRoleId ?? undefined)) result = await updateCustomRole(row.id, payload.customRoleId)
    if (payload.enabled !== row.enabled) result = await updateStatus(row.id, payload.enabled)
    return result
  }

  return { list, get, create, update, updateRole, updateCustomRole, updateStatus, resetPassword, remove, forceLogout, bulkForceLogout, applyEdits }
}

export const USER_ROLE_OPTIONS: { label: string; value: Role }[] = [
  { label: 'User', value: 'USER' },
  { label: 'Admin', value: 'ADMIN' }
]
