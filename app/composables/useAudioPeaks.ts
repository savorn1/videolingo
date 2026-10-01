// Reads the first seconds of an audio file in the browser so the waveform preview can move with
// the user's own sound (see shared/utils/waveSamples.ts). Everything stays on this device. Large
// files are skipped (decoding one means holding all of it in memory), and so is anything the
// browser can't decode — the preview then falls back to its generic sketch.

import { firstSeconds } from '#shared/utils/waveSamples'

/** Files above this are not decoded for the preview. */
export const MAX_PREVIEW_BYTES = 40 * 1024 * 1024

export interface AudioPeaks {
  samples: Float32Array
  sampleRate: number
}

export function useAudioPeaks() {
  const peaks = shallowRef<AudioPeaks | null>(null)
  const state = ref<'idle' | 'reading' | 'ready' | 'unavailable'>('idle')
  let token = 0

  async function load(file: File | null) {
    const mine = ++token
    peaks.value = null
    if (!file) {
      state.value = 'idle'
      return
    }
    if (file.size > MAX_PREVIEW_BYTES || typeof AudioContext === 'undefined') {
      state.value = 'unavailable'
      return
    }
    state.value = 'reading'
    let ctx: AudioContext | null = null
    try {
      ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer())
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
      const samples = firstSeconds(channels, decoded.sampleRate)
      if (mine !== token) return
      peaks.value = samples ? { samples, sampleRate: decoded.sampleRate } : null
      state.value = samples ? 'ready' : 'unavailable'
    } catch {
      if (mine === token) state.value = 'unavailable'
    } finally {
      void ctx?.close().catch(() => undefined)
    }
  }

  return { peaks, state, load }
}
