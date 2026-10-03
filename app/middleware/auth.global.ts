const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated, hasAnyAccess } = useAuth()
  if (PUBLIC_PATHS.includes(to.path)) {
    // Already signed in: the login form has nothing to offer — go where they were headed (or home).
    // (The forgot/reset-password pages stay open: a reset link can be followed while signed in.)
    if (to.path === '/login' && isAuthenticated.value) return navigateTo(safeRedirectTarget(to.query.redirect), { replace: true })
    return
  }
  if (isAuthenticated.value) {
    // Learners have nothing to manage — their home is the learning area.
    if (to.path === '/' && !hasAnyAccess.value) return navigateTo('/learn')
    return
  }
  // Remember where they were headed so signing in returns them there instead of
  // dumping them on the dashboard. The dashboard is already the default, so
  // there's nothing to remember for it.
  const redirect = to.fullPath === '/' ? undefined : to.fullPath
  return navigateTo({ path: '/login', query: redirect ? { redirect } : undefined })
})
