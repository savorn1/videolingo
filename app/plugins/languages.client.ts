// Loads the language catalog once at startup (public endpoint, no auth
// needed). A failure just leaves the built-in fallback list in place — labels
// still render; pickers offer the starter set until the next refresh.
export default defineNuxtPlugin(() => {
  const { refreshCatalog } = useLanguages()
  refreshCatalog()
})
