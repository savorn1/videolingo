import { defineConfig, devices } from '@playwright/test'

// Browser tests for the flows in docs/editor-scenarios.md. They run the real app (nuxt dev) against
// a mock backend (e2e/mock-backend.mjs), so no Java service or database is needed.
const MOCK_PORT = 8089
const APP_PORT = 3100

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${APP_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: `node e2e/mock-backend.mjs`, port: MOCK_PORT, env: { MOCK_PORT: String(MOCK_PORT) }, reuseExistingServer: !process.env.CI },
    {
      command: 'npx nuxt dev',
      port: APP_PORT,
      env: { NUXT_PORT: String(APP_PORT), NUXT_BACKEND_BASE: `http://localhost:${MOCK_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      // Vue's dev warnings are many and long; the tests report what matters. Run `npx nuxt dev` by hand to see them.
      stderr: 'ignore'
    }
  ]
})
