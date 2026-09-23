const backendBase = process.env.NUXT_BACKEND_BASE || 'http://localhost:8080'

export default defineEventHandler((event) => {
  if (import.meta.dev && event.path.startsWith('/api/')) {
    console.log(`[api] ${event.method} ${event.path} -> ${backendBase}${event.path}`)
  }
})
