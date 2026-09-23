// Loads the category catalog once at startup (public endpoint). On failure
// pickers are simply empty until the next refresh.
export default defineNuxtPlugin(() => {
  useCategories().refreshCatalog()
})
