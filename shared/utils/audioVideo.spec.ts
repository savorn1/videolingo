import { describe, expect, it } from 'vitest'
import {
  audioFileProblem,
  batchProblem,
  coverFileProblem,
  findAudioVideoJob,
  findMakingJob,
  isAudioVideoJob,
  finishedMaking,
  isHexColor,
  makingLabel,
  makingOperation,
  MAX_BATCH,
  nextToUpload,
  normalizeHexColor,
  DEFAULT_LOOK,
  sanitizeLook,
  submitBlocker,
  uniqueTitles,
  waveformPlacement
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

describe('makingOperation / findMakingJob', () => {
  const job = (id: number, operation: string) => ({ id, parameters: JSON.stringify({ operation }) })
  it('knows both ways of making a video', () => {
    expect(makingOperation('{"operation":"AUDIO_TO_VIDEO"}')).toBe('AUDIO_TO_VIDEO')
    expect(makingOperation('{"operation":"MERGE"}')).toBe('MERGE')
  })
  it('ignores other jobs and junk', () => {
    expect(makingOperation('{"operation":"TRIM"}')).toBeNull()
    expect(makingOperation('nope')).toBeNull()
    expect(makingOperation(null)).toBeNull()
    expect(makingOperation('null')).toBeNull()
  })
  it('finds the newest, whichever kind, and says which kind it is', () => {
    const found = findMakingJob([job(2, 'AUDIO_TO_VIDEO'), job(7, 'TRIM'), job(4, 'MERGE')])
    expect(found?.id).toBe(4)
    expect(found?.operation).toBe('MERGE')
  })
  it('is null when there is none', () => {
    expect(findMakingJob([job(1, 'TRIM')])).toBeNull()
    expect(findMakingJob([])).toBeNull()
  })
})

describe('sanitizeLook', () => {
  it('keeps valid settings', () => {
    const look = { background: '#1e3a8a', resolution: '1080p', waveform: 'BARS', waveAuto: false, waveColor: '#ff0000', normalize: true, denoise: true }
    expect(sanitizeLook(look)).toEqual(look)
  })
  it('falls back to the defaults for anything missing or wrong', () => {
    expect(sanitizeLook(null)).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook('x')).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook({})).toEqual(DEFAULT_LOOK)
    expect(sanitizeLook({ background: 'red', resolution: '4k', waveform: 'SPIRAL', waveAuto: 'yes', normalize: 1 })).toEqual(DEFAULT_LOOK)
  })
  it('fixes what can be fixed and keeps the rest', () => {
    expect(sanitizeLook({ background: '1E3A8A', resolution: '480p' })).toMatchObject({ background: '#1e3a8a', resolution: '480p', waveform: 'NONE' })
  })
})

describe('submitBlocker', () => {
  const ok = { files: 2, uploading: 0, untitled: 0, slideError: null }
  it('is null when everything is ready', () => {
    expect(submitBlocker(ok)).toBeNull()
  })
  it('names the first thing to fix', () => {
    expect(submitBlocker({ ...ok, files: 0 })).toMatch(/Add an audio/)
    expect(submitBlocker({ ...ok, uploading: 1 })).toBe('Uploading 1 file…')
    expect(submitBlocker({ ...ok, uploading: 3 })).toBe('Uploading 3 files…')
    expect(submitBlocker({ ...ok, untitled: 1 })).toBe('Give the video a title')
    expect(submitBlocker({ ...ok, untitled: 2 })).toBe('Give every video a title')
    expect(submitBlocker({ ...ok, slideError: 'Picture 2 must start later' })).toBe('Picture 2 must start later')
  })
  it('puts uploads before titles before pictures', () => {
    expect(submitBlocker({ files: 2, uploading: 1, untitled: 1, slideError: 'x' })).toMatch(/Uploading/)
    expect(submitBlocker({ files: 2, uploading: 0, untitled: 1, slideError: 'x' })).toMatch(/title/)
  })
})

describe('makingLabel', () => {
  it('says what is being made and how far along', () => {
    expect(makingLabel('MERGE', 'RUNNING', 40, null)).toBe('Joining videos · 40%')
    expect(makingLabel('AUDIO_TO_VIDEO', 'RUNNING', 7.6, null)).toBe('Making from audio · 8%')
  })
  it('says where a waiting one is in the queue', () => {
    expect(makingLabel('MERGE', 'QUEUED', 0, 3)).toBe('Joining videos · #3 in queue')
    expect(makingLabel('AUDIO_TO_VIDEO', 'QUEUED', 0, null)).toBe('Making from audio · waiting')
  })
  it('keeps the percentage in range', () => {
    expect(makingLabel('MERGE', 'RUNNING', -5, null)).toBe('Joining videos · 0%')
    expect(makingLabel('MERGE', 'RUNNING', 140, null)).toBe('Joining videos · 100%')
  })
})

describe('finishedMaking', () => {
  it('lists the videos that were being made and are not now', () => {
    expect(finishedMaking([1, 2, 3], new Set([2]))).toEqual([1, 3])
  })
  it('is empty when nothing finished', () => {
    expect(finishedMaking([1], new Set([1, 5]))).toEqual([])
    expect(finishedMaking([], new Set([1]))).toEqual([])
  })
})

describe('waveformPlacement', () => {
  it('puts the mirrored-bar styles in the middle and everything else along the bottom', () => {
    expect(waveformPlacement('PULSE')).toBe('CENTER')
    expect(waveformPlacement('BLOCKS')).toBe('CENTER')
    expect(waveformPlacement('FINE')).toBe('CENTER')
    expect(waveformPlacement('STRIPES')).toBe('CENTER')
    for (const s of ['WAVES', 'BARS', 'SPIKES', 'DOTS', 'SPECTRUM', 'NONE']) expect(waveformPlacement(s)).toBe('BOTTOM')
  })
})
