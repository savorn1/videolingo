const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

export default defineNuxtRouteMiddleware((to) => {
  if (PUBLIC_PATHS.includes(to.path)) return
  const { isAuthenticated } = useAuth()
  if (isAuthenticated.value) return
  // Remember where they were headed so signing in returns them there instead of
  // dumping them on the dashboard. The dashboard is already the default, so
  // there's nothing to remember for it.
  const redirect = to.fullPath === '/' ? undefined : to.fullPath
  return navigateTo({ path: '/login', query: redirect ? { redirect } : undefined })
})
