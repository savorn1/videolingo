import { describe, expect, it } from 'vitest'
import { failureGroups, reasonKey } from './failedJobs'

describe('failed jobs by reason', () => {
  it('treats messages that differ only in numbers as one reason', () => {
    expect(reasonKey('Video #42 not found (12.5 s)')).toBe(reasonKey('Video #7 not found (3 s)'))
    expect(reasonKey('Timed out')).not.toBe(reasonKey('Not found'))
  })

  it('groups, counts, lists the types and the retryable ids, most common first', () => {
    const groups = failureGroups([
      { id: 1, type: 'TRANSCRIBE', errorMessage: 'Speech-to-text is not reachable', canRetry: true },
      { id: 2, type: 'EDIT', errorMessage: 'Video #4 has no sound' },
      { id: 3, type: 'TRANSCRIBE', errorMessage: 'Speech-to-text is not reachable ', canRetry: false },
      { id: 4, type: 'DUB', errorMessage: 'Speech-to-text is not reachable', canRetry: true },
      { id: 5, type: 'EDIT', errorMessage: null }
    ])
    expect(groups.map((g) => [g.reason, g.count])).toEqual([
      ['Speech-to-text is not reachable', 3],
      ['Video #4 has no sound', 1],
      ['No reason given', 1]
    ])
    expect(groups[0]!.types).toEqual(['TRANSCRIBE', 'DUB'])
    expect(groups[0]!.retryable).toEqual([1, 4])
  })
})
