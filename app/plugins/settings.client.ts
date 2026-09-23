// Loads the client settings once signed in (and again after signing in as
// someone else), so limits and defaults across pages follow Settings.
// Deferred until the app is ready: applying them mid-hydration (the site name
// in the sidebar, say) would make the client render differ from the server's.
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const { isAuthenticated } = useAuth()
    const { settings, refresh } = useClientSettings()
    watch(
      isAuthenticated,
      (signedIn) => {
        if (signedIn) refresh()
        else settings.value = null
      },
      { immediate: true }
    )
  })
})
