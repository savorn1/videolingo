import { describe, expect, it } from 'vitest'
import { pushRecentPage, sanitizeRecentPages } from './recentPages'

describe('pushRecentPage', () => {
  it('puts the page first, moving it up with its newest label', () => {
    const list = [
      { path: '/videos', label: 'Videos' },
      { path: '/videos/7', label: 'Loading…' }
    ]
    expect(pushRecentPage(list, { path: '/videos/7', label: 'Sample lesson' })).toEqual([
      { path: '/videos/7', label: 'Sample lesson' },
      { path: '/videos', label: 'Videos' }
    ])
  })
  it('keeps at most the limit', () => {
    let list: { path: string; label: string }[] = []
    for (let i = 0; i < 10; i++) list = pushRecentPage(list, { path: `/p${i}`, label: `P${i}` }, 3)
    expect(list.map((p) => p.path)).toEqual(['/p9', '/p8', '/p7'])
  })
  it('skips sign-in pages and pages without a name', () => {
    const list = [{ path: '/videos', label: 'Videos' }]
    expect(pushRecentPage(list, { path: '/login', label: 'Sign in' })).toBe(list)
    expect(pushRecentPage(list, { path: '/tags', label: '  ' })).toBe(list)
  })
})

describe('sanitizeRecentPages', () => {
  it('keeps well-formed entries once each', () => {
    expect(
      sanitizeRecentPages([
        { path: '/a', label: 'A' },
        { path: 'http://x', label: 'X' },
        { path: '/a', label: 'again' },
        { path: '/b' },
        'junk',
        { path: '/c', label: ' C ' }
      ])
    ).toEqual([
      { path: '/a', label: 'A' },
      { path: '/c', label: 'C' }
    ])
    expect(sanitizeRecentPages('nope')).toEqual([])
  })
})
