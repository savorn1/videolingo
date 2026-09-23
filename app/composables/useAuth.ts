import type { ApiEnvelope } from '#shared/types'

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  username: string
  role: string
}

export function useAuth() {
  const { apiBase } = useRuntimeConfig().public

  // Cookie names are prefixed 'vl_' (rather than the generic 'auth_*')
  // because other local Nuxt apps on this machine run on localhost too, just
  // a different port — and per RFC 6265, cookies are scoped by domain only,
  // not port. Sharing the plain 'auth_token' name meant logging out of one
  // app cleared the other's session as well.
  const token = useCookie<string | null>('vl_auth_token', { default: () => null, sameSite: 'lax' })
  const refreshToken = useCookie<string | null>('vl_auth_refresh_token', {
    default: () => null,
    sameSite: 'lax'
  })
  const username = useCookie<string | null>('vl_auth_username', {
    default: () => null,
    sameSite: 'lax'
  })
  const role = useCookie<string | null>('vl_auth_role', { default: () => null, sameSite: 'lax' })
  // JSON-encoded PermissionGrant[] for the current USER account (see
  // UserServiceImpl.effectivePermissionsOf) — always empty for ADMIN, who
  // bypasses permission checks entirely. Refreshed on login/token refresh,
  // same lifecycle as `role`.
  const permissions = useCookie<string | null>('vl_auth_permissions', { default: () => null, sameSite: 'lax' })

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => role.value === 'ADMIN')

  function parsedPermissions(): { module: string; action: string }[] {
    if (!permissions.value) return []
    try {
      return JSON.parse(permissions.value)
    } catch {
      return []
    }
  }

  // Whether this account can reach the admin UI shell at all — ADMIN always
  // can; a USER can only if their custom role was granted at least one
  // permission. Individual pages/actions still enforce their own specific
  // module+action requirement against the backend, which is authoritative —
  // this is just the front-door gate (see middleware/admin.ts).
  const hasAnyAccess = computed(() => isAdmin.value || parsedPermissions().length > 0)

  function can(module: string, action: 'READ' | 'WRITE' | 'APPROVE') {
    return isAdmin.value || parsedPermissions().some((g) => g.module === module && g.action === action)
  }

  function applySession(res: AuthResponse) {
    token.value = res.accessToken
    refreshToken.value = res.refreshToken
    username.value = res.username
    role.value = res.role
  }

  // Best-effort — a failure here just means hasAnyAccess/can() fall back to
  // "no permissions", never blocking login itself.
  async function loadPermissions() {
    try {
      const res = await $fetch<ApiEnvelope<{ permissions?: { module: string; action: string }[] }>>('/api/users/me', {
        baseURL: apiBase,
        headers: { Authorization: `Bearer ${token.value}` }
      })
      permissions.value = JSON.stringify(res.data.permissions ?? [])
    } catch {
      permissions.value = JSON.stringify([])
    }
  }

  async function login(payload: LoginRequest) {
    const res = await $fetch<ApiEnvelope<AuthResponse>>('/api/auth/login', {
      baseURL: apiBase,
      method: 'POST',
      body: payload
    })
    applySession(res.data)
    await loadPermissions()
    return res.data
  }

  // Exchanges the stored refresh token for a new access + refresh token pair
  // (the old refresh token is rotated/invalidated server-side on use).
  async function refresh() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }
    const res = await $fetch<ApiEnvelope<AuthResponse>>('/api/auth/refresh', {
      baseURL: apiBase,
      method: 'POST',
      body: { refreshToken: refreshToken.value }
    })
    applySession(res.data)
    await loadPermissions()
    return res.data
  }

  const refreshOnce = dedupeRefresh(refresh)

  // Unauthenticated self-service reset. The backend answers the same way
  // whether or not the email matches an account, so there's nothing to
  // branch on here beyond success/failure of the request itself.
  async function forgotPassword(email: string) {
    await $fetch('/api/auth/forgot-password', {
      baseURL: apiBase,
      method: 'POST',
      body: { email }
    })
  }

  // `token` comes from the emailed /reset-password?token=… link. On success
  // the backend also revokes every existing session for that account.
  async function resetPassword(token: string, newPassword: string) {
    await $fetch('/api/auth/reset-password', {
      baseURL: apiBase,
      method: 'POST',
      body: { token, newPassword }
    })
  }

  async function logout() {
    const pendingRefreshToken = refreshToken.value
    token.value = null
    refreshToken.value = null
    username.value = null
    role.value = null
    permissions.value = null
    if (pendingRefreshToken) {
      // Best-effort server-side revocation — the client-side session is already
      // cleared above regardless of whether this call succeeds.
      await $fetch('/api/auth/logout', {
        baseURL: apiBase,
        method: 'POST',
        body: { refreshToken: pendingRefreshToken }
      }).catch(() => {})
    }
    await navigateTo('/login')
  }

  return {
    token,
    username,
    role,
    isAuthenticated,
    isAdmin,
    hasAnyAccess,
    can,
    login,
    refresh,
    refreshOnce,
    logout,
    forgotPassword,
    resetPassword
  }
}

function dedupeRefresh(refresh: () => Promise<AuthResponse>) {
  return function refreshOnce() {
    const inflight = useState<Promise<AuthResponse> | null>('auth-refresh-inflight', () => null)
    if (!inflight.value) {
      inflight.value = refresh().finally(() => {
        inflight.value = null
      })
    }
    return inflight.value
  }
}
