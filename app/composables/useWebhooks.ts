// Wraps the backend's WebhookController (/api/admin/webhooks/**), module
// "webhooks". Messages are signed — see WebhookSigner on the backend.

import type { ApiEnvelope } from '#shared/types'

export interface Webhook {
  id: number
  name: string
  url: string
  /** Signing secret, for the receiver to verify X-VideoLingo-Signature. */
  secret: string
  events: string[]
  enabled: boolean
  lastDeliveryAt: string | null
  /** 0 = no response. */
  lastStatus: number | null
  consecutiveFailures: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface WebhookDelivery {
  id: number
  messageId: string
  event: string
  attempt: number
  status: number
  success: boolean
  detail: string | null
  durationMs: number
  payload: string
  createdAt: string
}

export interface WebhookPayload {
  name: string
  url: string
  events: string[]
  enabled: boolean
}

export const WEBHOOK_EVENTS: { value: string; label: string; description: string }[] = [
  { value: 'job.succeeded', label: 'Job succeeded', description: 'A transcribe, translate, dub or download job finished' },
  { value: 'job.failed', label: 'Job failed', description: 'A processing job gave up with an error' },
  { value: 'subtitle.review_requested', label: 'Review requested', description: 'A subtitle track was sent for review' },
  { value: 'subtitle.approved', label: 'Subtitle approved', description: 'A reviewer approved a track' },
  { value: 'subtitle.changes_requested', label: 'Changes requested', description: 'A reviewer sent a track back' }
]

export function useWebhooks() {
  const api = useApi()
  const base = '/api/admin/webhooks'

  async function list() {
    return (await api<ApiEnvelope<Webhook[]>>(base)).data
  }

  async function create(payload: WebhookPayload) {
    return (await api<ApiEnvelope<Webhook>>(base, { method: 'POST', body: payload })).data
  }

  async function update(id: number, payload: WebhookPayload) {
    return (await api<ApiEnvelope<Webhook>>(`${base}/${id}`, { method: 'PUT', body: payload })).data
  }

  async function remove(id: number) {
    await api(`${base}/${id}`, { method: 'DELETE' })
  }

  async function rotateSecret(id: number) {
    return (await api<ApiEnvelope<Webhook>>(`${base}/${id}/rotate-secret`, { method: 'POST' })).data
  }

  async function sendTest(id: number) {
    return (await api<ApiEnvelope<WebhookDelivery>>(`${base}/${id}/test`, { method: 'POST' })).data
  }

  async function deliveries(id: number, limit = 50) {
    return (await api<ApiEnvelope<WebhookDelivery[]>>(`${base}/${id}/deliveries`, { query: { limit } })).data
  }

  return { list, create, update, remove, rotateSecret, sendTest, deliveries }
}
