// The editor's audio edit in progress — shared by the Audio tab (settings)
// and the audio strip under the preview (clips). Turns into the request
// POSTed to /edits/audio; the backend validates it again (AudioEditRules).

import type { AudioEditRequest } from '~/composables/useVideoEdits'
import { initialClips, isIdentityClips, validateClips, type AudioClip, type TimeRange } from '#shared/utils/audioEdit'

export interface UploadedAudio {
  key: string
  name: string
  /** Read in the browser before uploading; null when it couldn't tell. */
  durationMs: number | null
}

export interface MusicSettings extends UploadedAudio {
  volume: number
  loop: boolean
  duck: boolean
  startMs: number
}

export type Denoise = 'OFF' | 'LIGHT' | 'STRONG'
export type Channels = 'KEEP' | 'MONO' | 'STEREO'

export function useAudioEdit(durationMs: Ref<number>) {
  const state = reactive({
    source: 'ORIGINAL' as 'ORIGINAL' | 'UPLOAD',
    replacement: null as UploadedAudio | null,
    clips: [] as AudioClip[],
    selectedId: null as string | null,
    /** The timeline range "Mute range" / "Delete range" act on. */
    range: [0, 0] as [number, number],
    mutes: [] as TimeRange[],
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    normalize: false,
    denoise: 'OFF' as Denoise,
    enhanceVoice: false,
    speed: 1,
    pitchSemitones: 0,
    balance: 0,
    channels: 'KEEP' as Channels,
    music: null as MusicSettings | null
  })

  /** How long the sound clips are cut from is (the video, or the replacement file). */
  const sourceMs = computed(() => (state.source === 'UPLOAD' && state.replacement?.durationMs ? state.replacement.durationMs : durationMs.value))

  function resetClips() {
    state.clips = initialClips(sourceMs.value)
    state.selectedId = state.clips[0]?.id ?? null
  }

  function reset() {
    Object.assign(state, {
      source: 'ORIGINAL',
      replacement: null,
      range: [0, durationMs.value],
      mutes: [],
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
      normalize: false,
      denoise: 'OFF',
      enhanceVoice: false,
      speed: 1,
      pitchSemitones: 0,
      balance: 0,
      channels: 'KEEP',
      music: null
    })
    resetClips()
  }

  // A new source (or the video's length arriving) starts the clips over.
  watch(sourceMs, resetClips)
  watch(durationMs, (d) => {
    if (state.range[1] === 0) state.range = [0, d]
  })

  const replacing = computed(() => state.source === 'UPLOAD' && !!state.replacement)
  const clipsChanged = computed(() => !isIdentityClips(state.clips, sourceMs.value))

  const request = computed<AudioEditRequest>(() => ({
    replaceKey: replacing.value ? state.replacement!.key : null,
    clips: clipsChanged.value ? state.clips.map(({ srcStartMs, srcEndMs, atMs, gain }) => ({ srcStartMs, srcEndMs, atMs, gain })) : [],
    mutes: state.mutes,
    volume: state.volume,
    fadeInMs: state.fadeInMs,
    fadeOutMs: state.fadeOutMs,
    normalize: state.normalize,
    denoise: state.denoise,
    enhanceVoice: state.enhanceVoice,
    speed: state.speed,
    pitchSemitones: state.pitchSemitones,
    balance: state.balance,
    channels: state.channels,
    music: state.music
      ? { key: state.music.key, volume: state.music.volume, loop: state.music.loop, duck: state.music.duck, startMs: state.music.startMs }
      : null
  }))

  const changed = computed(
    () =>
      replacing.value ||
      clipsChanged.value ||
      state.mutes.length > 0 ||
      state.volume !== 1 ||
      state.fadeInMs > 0 ||
      state.fadeOutMs > 0 ||
      state.normalize ||
      state.denoise !== 'OFF' ||
      state.enhanceVoice ||
      state.speed !== 1 ||
      state.pitchSemitones !== 0 ||
      state.balance !== 0 ||
      state.channels !== 'KEEP' ||
      !!state.music
  )

  /** Why it can't be rendered yet, or null. */
  const error = computed(() => {
    if (state.source === 'UPLOAD' && !state.replacement) return 'Upload the replacement audio first'
    if (!changed.value) return 'Change something first'
    if (!state.clips.length && !state.music) return 'Every clip was deleted — there would be no sound left (use Volume 0% to silence it)'
    const clipError = validateClips(state.clips, durationMs.value)
    if (clipError) return clipError
    const outMs = durationMs.value / state.speed
    if (durationMs.value && state.fadeInMs + state.fadeOutMs > outMs) return 'The fades are longer than the video'
    return null
  })

  return { state, sourceMs, clipsChanged, request, changed, error, reset, resetClips }
}

export type AudioEdit = ReturnType<typeof useAudioEdit>
