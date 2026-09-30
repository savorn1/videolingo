import { describe, expect, it } from 'vitest'
import { audioFileProblem, coverFileProblem, isHexColor, normalizeHexColor } from './audioVideo'

const file = (name: string, type = '', size = 1000) => ({ name, type, size })

describe('audioFileProblem', () => {
  it('accepts audio by type or by extension', () => {
    expect(audioFileProblem(file('a.mp3', 'audio/mpeg'), 100)).toBeNull()
    expect(audioFileProblem(file('a.FLAC', ''), 100)).toBeNull()
    expect(audioFileProblem(file('noext', 'audio/wav'), 100)).toBeNull()
  })
  it('rejects other kinds of file', () => {
    expect(audioFileProblem(file('a.mp4', 'video/mp4'), 100)).not.toBeNull()
    expect(audioFileProblem(file('notes.txt', 'text/plain'), 100)).not.toBeNull()
  })
  it('rejects an empty or too large file', () => {
    expect(audioFileProblem(file('a.mp3', 'audio/mpeg', 0), 100)).toMatch(/empty/)
    expect(audioFileProblem(file('a.mp3', 'audio/mpeg', 101 * 1024 * 1024), 100)).toMatch(/100 MB/)
    expect(audioFileProblem(file('a.mp3', 'audio/mpeg', 100 * 1024 * 1024), 100)).toBeNull()
  })
})

describe('coverFileProblem', () => {
  it('accepts JPEG, PNG and WebP', () => {
    expect(coverFileProblem(file('c.png', 'image/png'))).toBeNull()
    expect(coverFileProblem(file('c.jpg', ''))).toBeNull()
    expect(coverFileProblem(file('c.webp', 'image/webp'))).toBeNull()
  })
  it('rejects other pictures and large ones', () => {
    expect(coverFileProblem(file('c.gif', 'image/gif'))).not.toBeNull()
    expect(coverFileProblem(file('c.png', 'image/png', 6 * 1024 * 1024))).toMatch(/5 MB/)
    expect(coverFileProblem(file('c.png', 'image/png', 0))).toMatch(/empty/)
  })
})

describe('colours', () => {
  it('knows the form the server wants', () => {
    expect(isHexColor('#1a2b3c')).toBe(true)
    expect(isHexColor('#1A2B3C')).toBe(true)
    expect(isHexColor('1a2b3c')).toBe(false)
    expect(isHexColor('#12345')).toBe(false)
  })
  it('reads what was typed', () => {
    expect(normalizeHexColor('1A2B3C')).toBe('#1a2b3c')
    expect(normalizeHexColor(' #1a2b3c ')).toBe('#1a2b3c')
    expect(normalizeHexColor('#fff')).toBeNull()
    expect(normalizeHexColor('red')).toBeNull()
    expect(normalizeHexColor('')).toBeNull()
  })
})
