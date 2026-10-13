// npm run gen:api — regenerates shared/api.generated.d.ts from the running backend's /v3/api-docs.
// The backend's address is NUXT_BACKEND_BASE: from the shell if set there, else from .env, else localhost:8080.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// loadEnvFile leaves variables already set in the shell alone, so `NUXT_BACKEND_BASE=… npm run gen:api` still wins.
if (existsSync('.env')) process.loadEnvFile('.env')
const base = (process.env.NUXT_BACKEND_BASE || 'http://localhost:8080').replace(/\/$/, '')
const out = 'shared/api.generated.d.ts'

try {
  execFileSync('npx', ['openapi-typescript', `${base}/v3/api-docs`, '-o', out], { stdio: 'inherit' })
} catch {
  console.error(`\nCouldn't read ${base}/v3/api-docs — is the backend running there? (NUXT_BACKEND_BASE, from the shell or .env)`)
  process.exit(1)
}
execFileSync('npx', ['prettier', '--write', out], { stdio: 'inherit' })
