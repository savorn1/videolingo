/** How long an audio file is, read in the browser before it is uploaded; null when it can't tell. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const a = new Audio()
    const done = (v: number | null) => {
      URL.revokeObjectURL(url)
      resolve(v)
    }
    a.preload = 'metadata'
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : null)
    a.onerror = () => done(null)
    a.src = url
  })
}
