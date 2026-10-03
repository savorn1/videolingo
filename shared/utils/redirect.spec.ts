import { describe, expect, it } from 'vitest'
import { safeRedirectTarget } from './redirect'

describe('safeRedirectTarget', () => {
  it('keeps internal paths, with their query', () => {
    expect(safeRedirectTarget('/videos/12/editor')).toBe('/videos/12/editor')
    expect(safeRedirectTarget('/videos?page=2&q=a')).toBe('/videos?page=2&q=a')
  })
  it('falls back to the dashboard for anything else', () => {
    for (const bad of [undefined, null, '', 'videos', 'https://evil.com', '//evil.com', '/\\evil.com', 42, {}]) {
      expect(safeRedirectTarget(bad)).toBe('/')
    }
  })
  it('takes the first of a repeated query value', () => {
    expect(safeRedirectTarget(['/learn', '/videos'])).toBe('/learn')
    expect(safeRedirectTarget(['https://evil.com'])).toBe('/')
  })
  it('never sends someone back to the login page', () => {
    expect(safeRedirectTarget('/login')).toBe('/')
    expect(safeRedirectTarget('/login?redirect=/videos')).toBe('/')
  })
})
