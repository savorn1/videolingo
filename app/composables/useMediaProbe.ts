// Reads what a browser can learn from a video file or URL by itself: length,
// dimensions and a frame for the thumbnail. The server has no ffmpeg, and for
// uploads the file never passes through it — so this is where it happens.

export interface MediaFacts {
  durationSeconds: number | null
  width: number | null
  height: number | null
}

const TIMEOUT_MS = 15_000

function loadMetadata(src: string, crossOrigin: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    if (crossOrigin) video.crossOrigin = 'anonymous'
    const timer = setTimeout(() => fail(new Error('Timed out reading the video')), TIMEOUT_MS)
    function fail(err: Error) {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      reject(err)
    }
    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        // Recorded WebM (and some streams) don't store their length: seeking far
        // past the end makes the browser work it out, then we rewind.
        video.addEventListener(
          'durationchange',
          () => {
            if (!Number.isFinite(video.duration)) return
            clearTimeout(timer)
            video.currentTime = 0
            resolve(video)
          },
          { once: false }
        )
        video.currentTime = 1e101
        return
      }
      clearTimeout(timer)
      resolve(video)
    }
    video.onerror = () => fail(new Error('This browser can’t read that video (unsupported format or unreachable)'))
    video.src = src
  })
}

function facts(video: HTMLVideoElement): MediaFacts {
  const d = video.duration
  return {
    durationSeconds: Number.isFinite(d) && d > 0 ? Math.round(d) : null,
    width: video.videoWidth || null,
    height: video.videoHeight || null
  }
}

/** Draws the frame at `atSeconds` to a JPEG. Throws if the video is cross-origin without CORS. */
export function captureFrame(video: HTMLVideoElement, atSeconds?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const draw = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) throw new Error('The video has no picture yet')
        // Cap at 1280 px wide — plenty for a thumbnail.
        const scale = Math.min(1, 1280 / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t capture a frame'))), 'image/jpeg', 0.85)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Couldn’t capture a frame'))
      }
    }
    if (atSeconds === undefined || Math.abs(video.currentTime - atSeconds) < 0.05) {
      if (video.readyState >= 2) draw()
      else video.addEventListener('loadeddata', draw, { once: true })
      return
    }
    video.addEventListener('seeked', draw, { once: true })
    video.currentTime = atSeconds
  })
}

// A moment that's usually past a black intro frame.
function thumbnailMoment(duration: number | null) {
  return duration ? Math.min(3, duration * 0.1) : 0.5
}

export function useMediaProbe() {
  /** A local file: always readable (same origin), so a frame is captured too. */
  async function probeFile(file: File): Promise<MediaFacts & { thumbnail: Blob | null; error: string | null }> {
    const url = URL.createObjectURL(file)
    try {
      const video = await loadMetadata(url, false)
      const f = facts(video)
      let thumbnail: Blob | null = null
      try {
        thumbnail = await captureFrame(video, thumbnailMoment(f.durationSeconds))
      } catch {
        // audio-only or undecodable picture — no thumbnail
      }
      return { ...f, thumbnail, error: null }
    } catch (err) {
      return { durationSeconds: null, width: null, height: null, thumbnail: null, error: (err as Error).message }
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * A video file on another site. Length/size need no CORS; a thumbnail frame
   * only works when that site allows cross-origin reads, so it's best-effort.
   */
  async function probeUrl(src: string): Promise<MediaFacts & { thumbnail: Blob | null; error: string | null }> {
    let f: MediaFacts
    try {
      f = facts(await loadMetadata(src, false))
    } catch (err) {
      return { durationSeconds: null, width: null, height: null, thumbnail: null, error: (err as Error).message }
    }
    let thumbnail: Blob | null = null
    try {
      const corsVideo = await loadMetadata(src, true)
      thumbnail = await captureFrame(corsVideo, thumbnailMoment(f.durationSeconds))
    } catch {
      // the host doesn't allow cross-origin frame reads — the admin can paste a thumbnail URL
    }
    return { ...f, thumbnail, error: null }
  }

  return { probeFile, probeUrl }
}
