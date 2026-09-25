// Plain-language descriptions of audit log entries ("Deleted video #12").

const NOUNS: Record<string, string> = {
  videos: 'video',
  subtitles: 'subtitle track',
  transcripts: 'transcript',
  categories: 'category',
  tags: 'tag',
  collections: 'collection',
  glossaries: 'glossary',
  users: 'user',
  'custom-roles': 'role',
  languages: 'language',
  settings: 'settings',
  notifications: 'notification',
  'notification-templates': 'notification template',
  'processing-jobs': 'processing job',
  ai: 'AI',
  'api-keys': 'API key',
  webhooks: 'webhook'
}

const AUTH: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  'forgot-password': 'Requested a password reset',
  'reset-password': 'Reset their password'
}

export interface AuditLike {
  method: string
  path: string
  module: string
  status: number
}

export function auditOutcome(status: number): 'success' | 'denied' | 'failed' {
  if (status === 401 || status === 403) return 'denied'
  return status >= 400 ? 'failed' : 'success'
}

export function describeAuditEntry(e: AuditLike): string {
  const parts = e.path.split('/').filter(Boolean)
  if (e.module === 'auth') {
    const what = AUTH[parts[2] ?? ''] ?? `Auth: ${parts.slice(2).join(' ')}`
    return e.path.endsWith('/login') && e.status >= 400 ? 'Failed sign-in' : what
  }
  if (e.module === 'profile') return e.path.endsWith('/password') ? 'Changed their password' : 'Updated their profile'
  if (e.module === 'files') return 'Uploaded a file'
  // /api/admin/<module>/<rest…>
  const rest = parts.slice(3)
  const noun = NOUNS[e.module] ?? e.module.replace(/-/g, ' ')
  const id = rest[0] && /^\d+$/.test(rest[0]) ? rest[0] : null
  const subject = id ? `${noun} #${id}` : noun
  const tail = id ? rest.slice(1) : rest
  const method = e.method.toUpperCase()
  if (!tail.length) {
    if (method === 'POST') return `Created ${noun}`
    if (method === 'PUT' || method === 'PATCH') return `Updated ${subject}`
    if (method === 'DELETE') return `Deleted ${subject}`
  }
  // Sub-resource or action: "approve", "revisions/4/restore", "tags/3"…
  const words = tail.filter((p) => !/^\d+$/.test(p)).map((p) => p.replace(/-/g, ' '))
  const action = words.join(' › ') || 'change'
  const verb = method === 'DELETE' ? 'Removed' : method === 'POST' ? '' : 'Updated'
  const phrase = verb ? `${verb} ${action}` : action.charAt(0).toUpperCase() + action.slice(1)
  return `${phrase} · ${subject}`
}
