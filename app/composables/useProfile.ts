// Wraps the backend's ProfileController (/api/users/me) — self-service
// view/edit of the current user's own profile and password.

import type { ApiEnvelope } from '#shared/types'

export interface Profile {
  id: number
  username: string
  email: string | null
  role: string
  enabled: boolean
}

export function useProfile() {
  const api = useApi()

  async function getProfile() {
    const res = await api<ApiEnvelope<Profile>>('/api/users/me')
    return res.data
  }

  async function updateProfile(payload: { email: string }) {
    const res = await api<ApiEnvelope<Profile>>('/api/users/me', {
      method: 'PUT',
      body: payload
    })
    return res.data
  }

  async function changePassword(payload: { currentPassword: string; newPassword: string }) {
    await api('/api/users/me/password', { method: 'PUT', body: payload })
  }

  return { getProfile, updateProfile, changePassword }
}
