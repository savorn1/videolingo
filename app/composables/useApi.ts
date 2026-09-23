// Thin wrapper around $fetch: attaches the Bearer token to every request. On a 401
// (expired/invalid access token) it silently exchanges the refresh token for a new
// access token and retries the request once; only if that also fails does it bounce
// to /login. All backend calls should go through this instead of raw $fetch.
export function useApi() {
  const { token, refreshOnce, logout } = useAuth()
  const { apiBase } = useRuntimeConfig().public

  const client = $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (token.value) {
        const headers = new Headers(options.headers as HeadersInit)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    }
  })

  // One refresh-and-retry wrapper shared by the body-only and raw variants.
  async function withRefresh<R>(call: () => Promise<R>): Promise<R> {
    try {
      return await call()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 401) {
        throw err
      }
      try {
        await refreshOnce()
        return await call()
      } catch {
        await logout()
        // Carry both why they're here and where they were, so the login page can
        // explain itself and put them back afterwards — otherwise an expired
        // session looks like the app randomly logged them out.
        const from = useRoute().fullPath
        await navigateTo({
          path: '/login',
          query: { reason: 'expired', ...(from && from !== '/' ? { redirect: from } : {}) }
        })
        throw err
      }
    }
  }

  // `any` here matches ofetch's own loosely-typed FetchOptions second parameter —
  // callers still get full inference on the return type via request<T>(...).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function request<T>(url: string, opts?: any): Promise<T> {
    return withRefresh(() => client<T>(url, opts))
  }

  // Full response (headers + body) — for downloads that need the server's
  // Content-Disposition filename.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request.raw = <T>(url: string, opts?: any) => withRefresh(() => client.raw<T>(url, opts))

  return request
}
