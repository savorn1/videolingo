import { describe, expect, it } from 'vitest'
import { errorCopy, nearbyPages, tabTitle } from './errorPage'

describe('errorCopy', () => {
  it('has plain words for the usual statuses', () => {
    expect(errorCopy(404).title).toBe('Page not found')
    expect(errorCopy(403).title).toMatch(/access/)
    expect(errorCopy(401).title).toMatch(/sign in/i)
  })
  it('treats every 5xx as our side of things', () => {
    for (const s of [500, 502, 503]) expect(errorCopy(s).title).toMatch(/our side/)
    expect(errorCopy(503).code).toBe('503')
  })
  it('falls back for anything else', () => {
    for (const s of [undefined, null, 0, 200, 418, 999]) {
      const copy = errorCopy(s as number | null | undefined)
      expect(copy.title).toBe('Something went wrong')
      expect(copy.description.length).toBeGreaterThan(0)
    }
    expect(errorCopy(418).code).toBe('418')
    expect(errorCopy(undefined).code).toBe('Error')
  })
})

describe('tabTitle', () => {
  it('puts the page before the site', () => {
    expect(tabTitle('Videos', 'VideoLingo')).toBe('Videos · VideoLingo')
  })
  it('is just the site name without a page title, or when they are the same', () => {
    expect(tabTitle(undefined, 'VideoLingo')).toBe('VideoLingo')
    expect(tabTitle('  ', 'VideoLingo')).toBe('VideoLingo')
    expect(tabTitle('VideoLingo', 'VideoLingo')).toBe('VideoLingo')
  })
})

describe('nearbyPages', () => {
  const pages = ['/', '/videos', '/videos/new', '/videos/:id', '/videos/from-audio', '/learn', '/learn/cards', '/users', '/users/:id']
  it('finds the page a word belongs to', () => {
    expect(nearbyPages('/new?sort=time', pages)).toEqual(['/videos/new'])
    expect(nearbyPages('/cards', pages)).toEqual(['/learn/cards'])
  })
  it('allows a singular for a plural', () => {
    expect(nearbyPages('/video', pages)[0]).toBe('/videos')
    expect(nearbyPages('/user/12', pages)).toEqual(['/users'])
  })
  it('suggests nothing when no word matches, and never a page with an id or the home page', () => {
    expect(nearbyPages('/nowhere', pages)).toEqual([])
    expect(nearbyPages('/', pages)).toEqual([])
    expect(nearbyPages('/videos/zzz', pages, 10).some((p) => p.includes(':') || p === '/')).toBe(false)
  })
  it('keeps to the limit', () => {
    expect(nearbyPages('/videos/x', pages, 2)).toHaveLength(2)
  })
})
