// Wraps the backend's NotificationController (/api/admin/notifications/**,
// module "notifications": GET = READ; sending, previewing, resending and
// template changes = WRITE) and MyNotificationController — the signed-in
// user's own in-app inbox (/api/users/me/notifications, any account).

import type { ApiEnvelope, PageEnvelope } from '#shared/types'
import type { NotificationChannel, NotificationStatus } from '#shared/utils/notifications'
import type { Role } from '~/composables/useUsers'

export interface NotificationTemplate {
  id: number
  code: string
  name: string
  description: string | null
  subject: string
  body: string
  defaultChannels: NotificationChannel[]
  /** Custom {{variables}} a sender must fill in (built-ins excluded). */
  variables: string[]
  /** Sends that used this template. */
  usageCount: number
  createdBy: string | null
  updatedBy: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface NotificationTemplatePayload {
  code: string
  name: string
  description?: string
  subject: string
  body: string
  defaultChannels: NotificationChannel[]
}

export interface NotificationTemplateFilter {
  search?: string
  channel?: NotificationChannel
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface NotificationEvent {
  id: number
  type: 'CREATED' | 'SENT' | 'FAILED' | 'RETRIED' | 'READ'
  detail: string | null
  actor: string | null
  createdAt: string
}

export interface AppNotification {
  id: number
  batchId: number
  recipientId: number | null
  recipientUsername: string
  recipientEmail: string | null
  channel: NotificationChannel
  status: NotificationStatus
  templateId: number | null
  templateCode: string | null
  subject: string
  /** Full on detail/inbox; the first ~160 chars in admin lists (see bodyTruncated). */
  body: string
  bodyTruncated: boolean
  attempts: number
  errorMessage: string | null
  sentBy: string | null
  createdAt: string
  sentAt: string | null
  readAt: string | null
  /** Detail only. */
  events: NotificationEvent[] | null
}

export interface NotificationFilter {
  search?: string
  recipientId?: number
  channel?: NotificationChannel
  status?: NotificationStatus
  batchId?: number
  templateId?: number
  read?: boolean
  from?: string
  to?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface SendNotificationPayload {
  templateId?: number
  subject?: string
  body?: string
  channels: NotificationChannel[]
  userIds?: number[]
  role?: Role
  allUsers?: boolean
  variables?: Record<string, string>
}

export interface NotificationPreview {
  subject: string
  body: string
  sampleRecipient: string | null
  recipientCount: number
  recipientsWithoutEmail: number
  disabledSkipped: number
  variables: string[]
  missingVariables: string[]
}

/** One send — a row in Notification History. */
export interface NotificationBatch {
  id: number
  templateId: number | null
  templateCode: string | null
  templateName: string | null
  subject: string
  channels: NotificationChannel[]
  audience: string
  recipientCount: number
  sentBy: string | null
  createdAt: string
  total: number
  sent: number
  failed: number
  pending: number
  read: number
  inApp: number
}

export interface NotificationBatchFilter {
  search?: string
  templateId?: number
  sentBy?: string
  from?: string
  to?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  size?: number
}

export interface NotificationServiceStatus {
  emailConfigured: boolean
  emailFrom: string
  builtInVariables: string[]
}

export function useNotifications() {
  const api = useApi()
  const base = '/api/admin/notifications'

  async function status() {
    return (await api<ApiEnvelope<NotificationServiceStatus>>(`${base}/status`)).data
  }

  function list(filter: NotificationFilter = {}) {
    return api<PageEnvelope<AppNotification>>(base, { query: filter })
  }

  async function get(id: number) {
    return (await api<ApiEnvelope<AppNotification>>(`${base}/${id}`)).data
  }

  async function send(payload: SendNotificationPayload) {
    return (await api<ApiEnvelope<NotificationBatch>>(`${base}/send`, { method: 'POST', body: payload })).data
  }

  async function preview(payload: SendNotificationPayload) {
    return (await api<ApiEnvelope<NotificationPreview>>(`${base}/preview`, { method: 'POST', body: payload })).data
  }

  /** Failed emails only. */
  async function resend(id: number) {
    return (await api<ApiEnvelope<AppNotification>>(`${base}/${id}/resend`, { method: 'POST' })).data
  }

  function history(filter: NotificationBatchFilter = {}) {
    return api<PageEnvelope<NotificationBatch>>(`${base}/history`, { query: filter })
  }

  async function batch(id: number) {
    return (await api<ApiEnvelope<NotificationBatch>>(`${base}/history/${id}`)).data
  }

  function templates(filter: NotificationTemplateFilter = {}) {
    return api<PageEnvelope<NotificationTemplate>>(`${base}/templates`, { query: filter })
  }

  async function getTemplate(id: number) {
    return (await api<ApiEnvelope<NotificationTemplate>>(`${base}/templates/${id}`)).data
  }

  async function createTemplate(payload: NotificationTemplatePayload) {
    return (await api<ApiEnvelope<NotificationTemplate>>(`${base}/templates`, { method: 'POST', body: payload })).data
  }

  async function updateTemplate(id: number, payload: NotificationTemplatePayload) {
    return (await api<ApiEnvelope<NotificationTemplate>>(`${base}/templates/${id}`, { method: 'PUT', body: payload })).data
  }

  async function removeTemplate(id: number) {
    await api(`${base}/templates/${id}`, { method: 'DELETE' })
  }

  return {
    status,
    list,
    get,
    send,
    preview,
    resend,
    history,
    batch,
    templates,
    getTemplate,
    createTemplate,
    updateTemplate,
    removeTemplate
  }
}

/** The signed-in user's own in-app notifications. */
export function useInbox() {
  const api = useApi()
  const base = '/api/users/me/notifications'

  function list(unreadOnly = false, page = 1, size = 10) {
    return api<PageEnvelope<AppNotification>>(base, { query: { unreadOnly, page, size } })
  }

  async function unreadCount() {
    return (await api<ApiEnvelope<{ unread: number }>>(`${base}/unread-count`)).data.unread
  }

  async function markRead(id: number) {
    return (await api<ApiEnvelope<AppNotification>>(`${base}/${id}/read`, { method: 'POST' })).data
  }

  async function markAllRead() {
    return (await api<ApiEnvelope<number>>(`${base}/read-all`, { method: 'POST' })).data
  }

  return { list, unreadCount, markRead, markAllRead }
}
