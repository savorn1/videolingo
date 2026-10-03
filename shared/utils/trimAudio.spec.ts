import { describe, expect, it } from 'vitest'
import { describeTrimAudio, newTrimAudio, trimAudioRequest, validateTrimAudio } from './trimAudio'

const file = { key: 'audio-uploads/a.mp3', name: 'a.mp3', durationMs: 4000 }

describe('trimAudioRequest', () => {
  it('is null without audio', () => expect(trimAudioRequest(null)).toBeNull())
  it('mixes music in', () => {
    const a = { ...newTrimAudio(file), volume: 0.3, startMs: 1200.4 }
    expect(trimAudioRequest(a)).toEqual({ music: { key: file.key, volume: 0.3, loop: true, duck: true, startMs: 1200 } })
  })
  it('replaces the sound', () => {
    expect(trimAudioRequest(newTrimAudio(file, 'REPLACE'))).toEqual({ replaceKey: file.key })
  })
})

describe('validateTrimAudio', () => {
  it('accepts no audio and sensible music', () => {
    expect(validateTrimAudio(null, 10000)).toBeNull()
    expect(validateTrimAudio(newTrimAudio(file), 10000)).toBeNull()
  })
  it('needs an uploaded file', () => {
    expect(validateTrimAudio({ ...newTrimAudio(file), key: '' }, 10000)).toMatch(/Upload/)
  })
  it('checks volume and start for music only', () => {
    expect(validateTrimAudio({ ...newTrimAudio(file), volume: 3 }, 10000)).toMatch(/volume/)
    expect(validateTrimAudio({ ...newTrimAudio(file), startMs: -1 }, 10000)).toMatch(/before/)
    expect(validateTrimAudio({ ...newTrimAudio(file), startMs: 10000 }, 10000)).toMatch(/after the end/)
    expect(validateTrimAudio({ ...newTrimAudio(file, 'REPLACE'), startMs: 99999 }, 10000)).toBeNull()
  })
})

describe('describeTrimAudio', () => {
  it('says what happens', () => {
    expect(describeTrimAudio(null)).toBeNull()
    expect(describeTrimAudio(newTrimAudio(file))).toBe('with "a.mp3" mixed in')
    expect(describeTrimAudio(newTrimAudio(file, 'REPLACE'))).toBe('with "a.mp3" instead of its sound')
  })
})
