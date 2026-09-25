import { describe, expect, it } from 'vitest'
import { auditOutcome, describeAuditEntry } from './audit'

const e = (method: string, path: string, module: string, status = 200) => ({ method, path, module, status })

describe('describeAuditEntry', () => {
  it('describes plain CRUD', () => {
    expect(describeAuditEntry(e('POST', '/api/admin/glossaries', 'glossaries', 201))).toBe('Created glossary')
    expect(describeAuditEntry(e('PUT', '/api/admin/videos/12', 'videos'))).toBe('Updated video #12')
    expect(describeAuditEntry(e('DELETE', '/api/admin/api-keys/3', 'api-keys'))).toBe('Deleted API key #3')
  })

  it('describes actions and sub-resources', () => {
    expect(describeAuditEntry(e('POST', '/api/admin/subtitles/9/approve', 'subtitles'))).toBe('Approve · subtitle track #9')
    expect(describeAuditEntry(e('POST', '/api/admin/subtitles/9/revisions/4/restore', 'subtitles'))).toBe('Revisions › restore · subtitle track #9')
    expect(describeAuditEntry(e('DELETE', '/api/admin/videos/5/tags/2', 'videos'))).toBe('Removed tags · video #5')
  })

  it('describes sign-ins', () => {
    expect(describeAuditEntry(e('POST', '/api/auth/login', 'auth'))).toBe('Signed in')
    expect(describeAuditEntry(e('POST', '/api/auth/login', 'auth', 401))).toBe('Failed sign-in')
    expect(describeAuditEntry(e('PUT', '/api/users/me/password', 'profile'))).toBe('Changed their password')
  })
})

describe('auditOutcome', () => {
  it('buckets statuses', () => {
    expect(auditOutcome(201)).toBe('success')
    expect(auditOutcome(403)).toBe('denied')
    expect(auditOutcome(409)).toBe('failed')
  })
})
