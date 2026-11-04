import { describe, expect, it } from 'vitest'
import { splitGenreLine, streamingFormFrom, streamingPayloadFrom, streamingProblems, streamingVisibilityNote, type StreamingSettings } from './streamingSeries'

const saved: StreamingSettings = {
  enabled: true,
  category: 'ROMANCE',
  status: 'COMPLETED',
  vip: true,
  freeEpisodes: 5,
  recapSeconds: 12,
  searchKeywords: 'summer love sneha',
  region: 'ចិន',
  releaseYear: 2026,
  genres: ['ស្នេហា', 'ទីក្រុង'],
  bannerUrl: 'https://cdn.example/banner.jpg',
  verticalUrl: null,
  featuredRank: 2
}

describe('streamingFormFrom / streamingPayloadFrom', () => {
  it('round-trips saved settings', () => {
    expect(streamingPayloadFrom(streamingFormFrom(saved))).toEqual(saved)
  })

  it('defaults to off with three free episodes', () => {
    const form = streamingFormFrom(null)
    expect(form.enabled).toBe(false)
    expect(form.freeEpisodes).toBe(3)
    expect(form.status).toBe('ONGOING')
    expect(form.genres).toBe('')
  })

  it('sends blank text as null and trims the rest', () => {
    const form = { ...streamingFormFrom(saved), region: '   ', searchKeywords: '  sneha  ' }
    const payload = streamingPayloadFrom(form)
    expect(payload.region).toBeNull()
    expect(payload.searchKeywords).toBe('sneha')
  })
})

describe('splitGenreLine', () => {
  it('splits on commas, trims and drops blanks', () => {
    expect(splitGenreLine(' ស្នេហា ,  ,ទីក្រុង   និង  មហាសេដ្ឋី,')).toEqual(['ស្នេហា', 'ទីក្រុង និង មហាសេដ្ឋី'])
  })
})

describe('streamingProblems', () => {
  const on = () => ({ ...streamingFormFrom(saved) })

  it('has nothing to say while the series is off', () => {
    expect(streamingProblems({ ...on(), enabled: false, category: undefined, recapSeconds: -5 })).toEqual([])
  })

  it('accepts valid settings', () => {
    expect(streamingProblems(on())).toEqual([])
  })

  it('needs a category', () => {
    expect(streamingProblems({ ...on(), category: undefined })).toEqual(['Pick a category so the series is listed on the right shelf.'])
  })

  it('checks the number limits', () => {
    const problems = streamingProblems({ ...on(), freeEpisodes: 101, recapSeconds: 2.5, releaseYear: 1800 })
    expect(problems).toHaveLength(3)
  })

  it('only checks free episodes for VIP series', () => {
    expect(streamingProblems({ ...on(), vip: false, freeEpisodes: 999 })).toEqual([])
  })

  it('limits genres', () => {
    expect(streamingProblems({ ...on(), genres: 'a, b, c, d, e, f' })).toEqual(['At most 5 genres (you have 6).'])
    expect(streamingProblems({ ...on(), genres: 'x'.repeat(61) })).toEqual(['Each genre can be at most 60 characters.'])
  })

  it('wants full http(s) links for artwork', () => {
    expect(streamingProblems({ ...on(), bannerUrl: 'banner.jpg', verticalUrl: 'javascript:alert(1)' })).toEqual([
      'Banner image must be a full http(s) link.',
      'Vertical image must be a full http(s) link.'
    ])
  })
})

describe('streamingVisibilityNote', () => {
  it('warns when a series is on but the collection is not Public', () => {
    expect(streamingVisibilityNote(true, 'UNLISTED')).toMatch(/Only Public collections/)
    expect(streamingVisibilityNote(true, 'PUBLIC')).toBeNull()
    expect(streamingVisibilityNote(false, 'PRIVATE')).toBeNull()
  })
})
