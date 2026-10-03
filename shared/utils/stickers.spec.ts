import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_STICKERS,
  PLAIN_STICKER,
  describeLook,
  nextTurn,
  STICKER_GROUPS,
  filterStickerGroups,
  isSingleEmoji,
  pushRecentSticker,
  sanitizeRecentStickers,
  stickerFileName
} from './stickers'

describe('stickerFileName', () => {
  it('slugs the name', () => {
    expect(stickerFileName('thumbs up')).toBe('sticker-thumbs-up.png')
    expect(stickerFileName('  Hello, World! ')).toBe('sticker-hello-world.png')
  })
  it('falls back when nothing is left', () => {
    expect(stickerFileName('???')).toBe('sticker-emoji.png')
  })
})

describe('STICKER_GROUPS', () => {
  it('has no duplicate emoji or names', () => {
    const items = STICKER_GROUPS.flatMap((g) => g.items)
    expect(new Set(items.map((i) => i.emoji)).size).toBe(items.length)
    expect(new Set(items.map((i) => i.name)).size).toBe(items.length)
  })
})

describe('filterStickerGroups', () => {
  it('returns everything for an empty query', () => {
    expect(filterStickerGroups(STICKER_GROUPS, ' ')).toBe(STICKER_GROUPS)
  })
  it('matches names and drops empty groups', () => {
    const r = filterStickerGroups(STICKER_GROUPS, 'fire')
    expect(r).toHaveLength(1)
    expect(r[0]!.items.map((i) => i.emoji)).toEqual(['🔥'])
  })
  it('keeps a whole group when its label matches', () => {
    const r = filterStickerGroups(STICKER_GROUPS, 'media')
    expect(r[0]!.items.length).toBeGreaterThan(5)
  })
})

describe('recent stickers', () => {
  const a = { emoji: '🔥', name: 'fire' }
  const b = { emoji: '⭐', name: 'star' }
  it('moves a repeat to the front and caps the list', () => {
    expect(pushRecentSticker([a, b], b)).toEqual([b, a])
    const many = Array.from({ length: 12 }, (_, i) => ({ emoji: String(i), name: 'x' }))
    expect(pushRecentSticker(many, a)).toHaveLength(MAX_RECENT_STICKERS)
  })
  it('sanitises stored data', () => {
    expect(sanitizeRecentStickers('nope')).toEqual([])
    expect(sanitizeRecentStickers([a, a, { emoji: 1 }, null, { emoji: '', name: 'x' }])).toEqual([a])
  })
})

describe('isSingleEmoji', () => {
  it('accepts one emoji, including joined ones', () => {
    expect(isSingleEmoji('🔥')).toBe(true)
    expect(isSingleEmoji('👨‍👩‍👧')).toBe(true)
  })
  it('rejects text, several emoji and empty input', () => {
    expect(isSingleEmoji('')).toBe(false)
    expect(isSingleEmoji('abc')).toBe(false)
    expect(isSingleEmoji('🔥🔥')).toBe(false)
  })
})

describe('sticker look', () => {
  it('turns a quarter at a time and comes back round', () => {
    expect(nextTurn(0)).toBe(90)
    expect(nextTurn(270)).toBe(0)
  })
  it('describes only what changed', () => {
    expect(describeLook(PLAIN_STICKER)).toBe('')
    expect(describeLook({ flip: true, turn: 0 })).toBe(' (mirrored)')
    expect(describeLook({ flip: true, turn: 90 })).toBe(' (mirrored, turned 90°)')
  })
  it('puts a changed look in the file name', () => {
    expect(stickerFileName('fire')).toBe('sticker-fire.png')
    expect(stickerFileName('fire', { flip: true, turn: 180 })).toBe('sticker-fire-mirrored-180.png')
  })
})
