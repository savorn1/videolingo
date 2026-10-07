import type { BrowserContext, Page } from '@playwright/test'

const MOCK = 'http://localhost:8089'

/** Signs in as an admin the way the app remembers it: the auth cookies (the mock backend accepts any token). */
export async function signInAsAdmin(context: BrowserContext) {
  const cookie = (name: string, value: string) => ({ name, value, domain: 'localhost', path: '/', sameSite: 'Lax' as const })
  await context.addCookies([cookie('vl_auth_token', 'e2e-token'), cookie('vl_auth_role', 'ADMIN'), cookie('vl_auth_username', 'admin')])
}

/** Clears what the mock backend recorded and sets how it answers (e.g. `{ waveforms: [...] }` for an older server). */
export async function resetMock(config: Record<string, unknown> = {}) {
  await fetch(`${MOCK}/__reset`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) })
}

/** Changes how the mock answers without forgetting what it recorded. */
export async function configureMock(config: Record<string, unknown>) {
  await fetch(`${MOCK}/__config`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config) })
}

/** The requests the app sent to the backend, in order. */
export async function mockRequests(): Promise<{ method: string; path: string; body: any }[]> {
  return (await fetch(`${MOCK}/__requests`)).json()
}

/** A short mono 16-bit WAV of a quiet tone, `seconds` long, as a file for an <input type="file">. */
export function wavFile(name: string, seconds = 2) {
  const rate = 8000
  const n = rate * seconds
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 8000), 44 + i * 2)
  return { name, mimeType: 'audio/wav', buffer: buf }
}

/**
 * Opens a page and waits until the app is ready to use: the settings plugin asks for the client settings once
 * hydration is done (onNuxtReady), so until then clicks and file inputs would reach markup with no handlers yet.
 */
export async function openReady(page: Page, url: string) {
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/settings/client')), page.goto(url)])
}
