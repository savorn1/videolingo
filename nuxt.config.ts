// The backend has no CORS config, so the browser can't call it
// cross-origin directly. Instead every client call hits this server's own
// /api/** (same origin, baseURL: '') and Nitro's routeRules proxy it
// server-to-server, where CORS doesn't apply.
const backendBase = process.env.NUXT_BACKEND_BASE || 'http://localhost:8080'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/ui'],

  // `cancelled` is a seventh color alias on top of Nuxt UI's six defaults —
  // StatusBadge uses it for CANCELLED/REJECTED so those don't share `neutral`
  // with genuinely inert states, and the leads board uses it for its Lost
  // column. Registering the palette in app.config.ts (`colors.cancelled:
  // 'copper'`) is only half of it: this list is what Nuxt UI generates both
  // the CSS variables *and* the `color` prop types from, so without it
  // `:color="'cancelled'"` renders correctly but fails typecheck. Naming any
  // colors here replaces the default list rather than extending it, so all
  // six defaults have to be repeated. `neutral` is configured separately and
  // deliberately absent.
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'cancelled']
    }
  },

  devServer: {
    port: Number(process.env.NUXT_PORT) || 3000
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'VideoLingo'
    }
  },

  runtimeConfig: {
    public: {
      apiBase: ''
    }
  },

  // Nuxt Icon serves icon data from its own /api/_nuxt_icon/** route by
  // default, which collides with the catch-all /api/** proxy below (that
  // sent icon requests to the backend and returned 401s, breaking every
  // lucide icon). Move it outside /api/ so the proxy never sees it.
  icon: {
    localApiEndpoint: '/_nuxt_icon'
  },

  routeRules: {
    '/api/**': { proxy: `${backendBase}/api/**` }
  },

  // useApi()'s 401-retry flow (refresh then redirect to /login on failure) calls
  // composables like navigateTo()/useCookie() after crossing several `await`
  // boundaries; without this, Nuxt loses track of the current app instance at that
  // point and throws instead of redirecting.
  experimental: {
    asyncContext: true
  },

  typescript: {
    strict: true,
    // vitest.config.ts/vitest.setup.ts live at the project root, outside
    // app/server/shared, so Nuxt's default include globs (app/**/*, shared/**/*,
    // etc.) miss them. Nuxt concatenates this onto its own generated `include`
    // (see tsconfig.json's `extends`), so both files get real project coverage
    // instead of falling back to an editor "inferred project" that can't follow
    // vitest's conditional `exports` map (e.g. the `./config` subpath).
    tsConfig: {
      include: ['../vitest.config.ts', '../vitest.setup.ts']
    }
  }
})
