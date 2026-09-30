import { describe, expect, it } from 'vitest'
import {
  audioFileProblem,
  batchProblem,
  coverFileProblem,
  findAudioVideoJob,
  isAudioVideoJob,
  isHexColor,
  MAX_BATCH,
  nextToUpload,
  normalizeHexColor,
  uniqueTitles
} from './audioVideo'

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

describe('batchProblem', () => {
  it('allows up to the limit', () => {
    expect(batchProblem(1)).toBeNull()
    expect(batchProblem(MAX_BATCH)).toBeNull()
    expect(batchProblem(MAX_BATCH + 1)).toMatch(String(MAX_BATCH))
  })
})

describe('uniqueTitles', () => {
  it('leaves distinct titles alone', () => {
    expect(uniqueTitles(['One', 'Two'])).toEqual(['One', 'Two'])
  })
  it('numbers repeats, ignoring case', () => {
    expect(uniqueTitles(['Lesson', 'lesson', 'Lesson', 'Other'])).toEqual(['Lesson', 'lesson (2)', 'Lesson (3)', 'Other'])
  })
  it('handles an empty list', () => {
    expect(uniqueTitles([])).toEqual([])
  })
})

describe('nextToUpload', () => {
  it('picks the first queued file', () => {
    expect(nextToUpload(['ready', 'queued', 'queued'])).toBe(1)
  })
  it('waits while one is uploading', () => {
    expect(nextToUpload(['uploading', 'queued'])).toBeNull()
  })
  it('is null when nothing is waiting', () => {
    expect(nextToUpload([])).toBeNull()
    expect(nextToUpload(['ready', 'error'])).toBeNull()
  })
})

describe('isAudioVideoJob', () => {
  it('reads the operation from the job parameters', () => {
    expect(isAudioVideoJob('{"operation":"AUDIO_TO_VIDEO","audioKey":"x"}')).toBe(true)
    expect(isAudioVideoJob('{"operation":"TRIM"}')).toBe(false)
  })
  it('is false for nothing or junk', () => {
    expect(isAudioVideoJob(null)).toBe(false)
    expect(isAudioVideoJob('')).toBe(false)
    expect(isAudioVideoJob('not json')).toBe(false)
    expect(isAudioVideoJob('null')).toBe(false)
  })
})

describe('findAudioVideoJob', () => {
  const job = (id: number, operation: string) => ({ id, parameters: JSON.stringify({ operation }) })
  it('finds the newest audio-to-video job whatever the order', () => {
    expect(findAudioVideoJob([job(3, 'AUDIO_TO_VIDEO'), job(9, 'TRIM'), job(5, 'AUDIO_TO_VIDEO')])?.id).toBe(5)
  })
  it('is null when there is none', () => {
    expect(findAudioVideoJob([job(1, 'TRIM')])).toBeNull()
    expect(findAudioVideoJob([])).toBeNull()
  })
})
