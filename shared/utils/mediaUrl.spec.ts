import { describe, expect, it } from 'vitest'
import { isSignedUrl, mediaKey } from './mediaUrl'

const signed = 'https://cdn.example.com/media/videos/1/a.mp4?X-Amz-Expires=10800&X-Amz-Signature=abc'

describe('mediaKey', () => {
  it('is the same for every signed copy of a file', () => {
    expect(mediaKey(signed)).toBe('https://cdn.example.com/media/videos/1/a.mp4')
    expect(mediaKey(signed.replace('abc', 'def'))).toBe(mediaKey(signed))
    expect(mediaKey('https://cdn.example.com/media/videos/1/a.mp4')).toBe(mediaKey(signed))
  })
  it('drops a fragment too, and is empty for nothing', () => {
    expect(mediaKey('https://x.test/a.mp4#t=0.1')).toBe('https://x.test/a.mp4')
    expect(mediaKey(null)).toBe('')
    expect(mediaKey(undefined)).toBe('')
  })
})

describe('isSignedUrl', () => {
  it('spots presigned links', () => {
    expect(isSignedUrl(signed)).toBe(true)
    expect(isSignedUrl('https://x.test/a.mp4?size=2')).toBe(false)
    expect(isSignedUrl('https://youtu.be/x')).toBe(false)
    expect(isSignedUrl(null)).toBe(false)
  })
})
