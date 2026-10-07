import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds the Playwright browser tests (npm run test:e2e).
    exclude: [...configDefaults.exclude, 'e2e/**']
  }
})
