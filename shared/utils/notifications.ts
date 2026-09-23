// Display helpers and {{variable}} parsing for notifications. The parsing
// mirrors the backend's TemplateRenderer so the form can show, while typing,
// which values a send will ask for.

export type NotificationChannel = 'IN_APP' | 'EMAIL'
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED'

export const NOTIFICATION_CHANNELS: { value: NotificationChannel; label: string; icon: string; description: string }[] = [
  { value: 'IN_APP', label: 'In-app', icon: 'i-lucide-bell', description: 'Shows in the recipient’s inbox (the bell)' },
  { value: 'EMAIL', label: 'Email', icon: 'i-lucide-mail', description: 'Sent to the account’s email address' }
]

export const NOTIFICATION_STATUSES: { value: NotificationStatus; label: string; color: 'warning' | 'success' | 'error'; icon: string }[] = [
  { value: 'PENDING', label: 'Pending', color: 'warning', icon: 'i-lucide-clock' },
  { value: 'SENT', label: 'Sent', color: 'success', icon: 'i-lucide-check' },
  { value: 'FAILED', label: 'Failed', color: 'error', icon: 'i-lucide-circle-x' }
]

/** Filled per recipient by the server. */
export const BUILT_IN_VARIABLES: { name: string; description: string }[] = [
  { name: 'username', description: 'Recipient’s username' },
  { name: 'email', description: 'Recipient’s email' },
  { name: 'role', description: 'admin or user' },
  { name: 'appName', description: 'VideoLingo' },
  { name: 'appUrl', description: 'Link to the app' },
  { name: 'date', description: 'Today, e.g. 23 Sep 2026' }
]

const VARIABLE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g

/** Variable names used across the texts, in order of first appearance. */
export function templateVariables(...texts: (string | null | undefined)[]): string[] {
  const names: string[] = []
  for (const text of texts) {
    for (const match of (text ?? '').matchAll(VARIABLE)) {
      if (!names.includes(match[1]!)) names.push(match[1]!)
    }
  }
  return names
}

/** The variables a sender must supply — everything that isn't built in. */
export function customVariables(...texts: (string | null | undefined)[]): string[] {
  const builtIns = BUILT_IN_VARIABLES.map((v) => v.name)
  return templateVariables(...texts).filter((name) => !builtIns.includes(name))
}

export function channelMeta(channel: string) {
  return NOTIFICATION_CHANNELS.find((c) => c.value === channel) ?? { value: channel, label: channel, icon: 'i-lucide-bell', description: '' }
}

export function notificationStatusMeta(status: string) {
  return NOTIFICATION_STATUSES.find((s) => s.value === status) ?? { value: status, label: status, color: 'warning' as const, icon: 'i-lucide-circle' }
}
