// ADMIN always passes. A USER account passes only if their assigned custom
// role was granted at least one permission — otherwise there's nothing for
// them to do in here at all. This is just the front-door gate; the specific
// module+action a page/action actually needs is enforced by the backend
// (PermissionAuthorizationManager), which is authoritative — a USER who gets
// past this gate but lacks a specific grant just sees a 403 from that call.
export default defineNuxtRouteMiddleware(() => {
  const { hasAnyAccess } = useAuth()
  if (!hasAnyAccess.value) return navigateTo('/')
})
