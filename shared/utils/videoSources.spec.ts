import { describe, expect, it } from 'vitest'
import { extractUrl, isVideoFile, linkProblem, parseDurationInput, titleFromFileName } from './videoSources'

describe('extractUrl', () => {
  it('finds a full link inside pasted text', () => {
    expect(extractUrl('Check this out: https://youtu.be/dQw4w9WgXcQ?si=abc, it is great')).toBe('https://youtu.be/dQw4w9WgXcQ?si=abc')
  })

  it('accepts bare platform addresses', () => {
    expect(extractUrl('youtu.be/dQw4w9WgXcQ')).toBe('youtu.be/dQw4w9WgXcQ')
    expect(extractUrl('see www.facebook.com/reel/123456')).toBe('www.facebook.com/reel/123456')
  })

  it('returns null without a link', () => {
    expect(extractUrl('just some words')).toBeNull()
    expect(extractUrl(null)).toBeNull()
  })
})

describe('linkProblem', () => {
  it('accepts links with or without a scheme', () => {
    expect(linkProblem('https://vimeo.com/1084537')).toBeNull()
    expect(linkProblem('youtu.be/abc')).toBeNull()
    expect(linkProblem('')).toBeNull()
  })

  it('explains bad input', () => {
    expect(linkProblem('ftp://x.com/a.mp4')).toMatch(/http/)
    expect(linkProblem('two words')).toMatch(/spaces/)
    expect(linkProblem('localhost')).toMatch(/website/)
  })
})

describe('parseDurationInput', () => {
  it('reads clock and plain seconds', () => {
    expect(parseDurationInput('3:34')).toBe(214)
    expect(parseDurationInput('1:02:03')).toBe(3723)
    expect(parseDurationInput('95')).toBe(95)
    expect(parseDurationInput('')).toBeNull()
  })

  it('rejects invalid clocks', () => {
    expect(parseDurationInput('1:75')).toBeNull()
    expect(parseDurationInput('a:b')).toBeNull()
  })
})

describe('files', () => {
  it('recognises video files by type or extension', () => {
    expect(isVideoFile({ name: 'a.bin', type: 'video/mp4' })).toBe(true)
    expect(isVideoFile({ name: 'clip.MKV', type: '' })).toBe(true)
    expect(isVideoFile({ name: 'notes.pdf', type: 'application/pdf' })).toBe(false)
  })

  it('turns file names into titles', () => {
    expect(titleFromFileName('lesson_01-ordering.coffee.mp4')).toBe('Lesson 01 ordering coffee')
  })
})
