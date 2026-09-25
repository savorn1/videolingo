import { describe, expect, it } from 'vitest'
import { splitWords } from './words'

describe('splitWords', () => {
  it('marks words, keeping spaces and punctuation as plain text', () => {
    const pieces = splitWords('Hello, world! 42 times.', 'en')
    expect(pieces.map((p) => p.text).join('')).toBe('Hello, world! 42 times.')
    expect(pieces.filter((p) => p.word).map((p) => p.text)).toEqual(['Hello', 'world', 'times'])
  })

  it('finds words in scripts without spaces', () => {
    const words = splitWords('東京に行きます', 'ja').filter((p) => p.word)
    expect(words.length).toBeGreaterThan(1)
    expect(words.map((p) => p.text).join('')).toBe('東京に行きます')
  })

  it('handles empty text', () => {
    expect(splitWords('', 'en')).toEqual([])
  })
})
