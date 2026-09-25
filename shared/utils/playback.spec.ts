import { describe, expect, it } from 'vitest'
import { isVimeoEmbed, isYouTubeEmbed, playerEmbedUrl, resumePosition, youTubeErrorMessage, youTubeThumbnail } from './playback'

describe('playerEmbedUrl', () => {
  it('switches YouTube to privacy mode with the player API on', () => {
    const url = new URL(playerEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ?start=5', { origin: 'https://admin.example.com' }))
    expect(url.hostname).toBe('www.youtube-nocookie.com')
    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ')
    expect(url.searchParams.get('start')).toBe('5')
    expect(url.searchParams.get('enablejsapi')).toBe('1')
    expect(url.searchParams.get('origin')).toBe('https://admin.example.com')
    expect(url.searchParams.has('autoplay')).toBe(false)
  })

  it('adds autoplay in each platform’s own form', () => {
    expect(new URL(playerEmbedUrl('https://youtube.com/embed/abcdefghijk', { autoplay: true })).searchParams.get('autoplay')).toBe('1')
    expect(new URL(playerEmbedUrl('https://player.vimeo.com/video/1084537', { autoplay: true })).searchParams.get('autoplay')).toBe('1')
    const fb = 'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1'
    expect(new URL(playerEmbedUrl(fb, { autoplay: true })).searchParams.get('autoplay')).toBe('true')
  })

  it('leaves other and unreadable addresses alone', () => {
    expect(playerEmbedUrl('https://player.vimeo.com/video/1084537')).toBe('https://player.vimeo.com/video/1084537')
    expect(playerEmbedUrl('not a url')).toBe('not a url')
  })
})

describe('embed detection', () => {
  it('recognises YouTube (incl. privacy mode) and Vimeo players', () => {
    expect(isYouTubeEmbed('https://www.youtube.com/embed/x')).toBe(true)
    expect(isYouTubeEmbed('https://www.youtube-nocookie.com/embed/x')).toBe(true)
    expect(isYouTubeEmbed('https://www.youtube.com/watch?v=x')).toBe(false)
    expect(isVimeoEmbed('https://player.vimeo.com/video/1')).toBe(true)
    expect(isVimeoEmbed(null)).toBe(false)
  })
})

describe('youTubeThumbnail', () => {
  it('builds the still image address from the video ID', () => {
    expect(youTubeThumbnail('https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(youTubeThumbnail('https://player.vimeo.com/video/1')).toBeNull()
  })
})

describe('youTubeErrorMessage', () => {
  it('explains the common codes', () => {
    expect(youTubeErrorMessage(100)).toMatch(/removed or made private/)
    expect(youTubeErrorMessage(150)).toMatch(/other sites/)
    expect(youTubeErrorMessage(101)).toBe(youTubeErrorMessage(150))
    expect(youTubeErrorMessage(999)).toMatch(/couldn't play/)
  })
})

describe('resumePosition', () => {
  it('resumes from the middle of a video', () => {
    expect(resumePosition(125, 600)).toBe(125)
    expect(resumePosition(125, null)).toBe(125)
  })

  it('starts over near the beginning or the end', () => {
    expect(resumePosition(4, 600)).toBeNull()
    expect(resumePosition(595, 600)).toBeNull()
    expect(resumePosition(null, 600)).toBeNull()
    expect(resumePosition(Number.NaN)).toBeNull()
  })
})
