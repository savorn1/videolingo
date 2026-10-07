// Sending a large file to storage in parts (the backend's MultipartRules): a few parts at a time, each
// retried a few times before giving up, and the parts already stored remembered, so trying again picks up
// where it stopped instead of starting over. The network calls are passed in, which keeps this testable.

/** Files at least this big are sent in parts (mirrors MultipartRules.THRESHOLD_BYTES). */
export const MULTIPART_THRESHOLD = 64 * 1024 * 1024

/** Parts sent at once. */
export const PART_CONCURRENCY = 3

/** Tries per part before the upload stops (and can be resumed). */
export const PART_ATTEMPTS = 3

/** How long to wait before try `attempt` (2, 3, …) of a part: 1 s, then 3 s, then 9 s. */
export function retryDelayMs(attempt: number): number {
  return attempt <= 1 ? 0 : 1000 * 3 ** (attempt - 2)
}

/** Bytes [start, end) of part `n` (1-based) of a `size`-byte file in `partSize` parts. */
export function partRange(size: number, partSize: number, n: number): [number, number] {
  const start = (n - 1) * partSize
  return [start, Math.min(size, start + partSize)]
}

export interface PartsJob {
  size: number
  partSize: number
  partCount: number
  /** Parts already stored (from an earlier try); filled in as parts finish. */
  done: Set<number>
  /** Sends part `n`, reporting bytes sent so far; rejects when it fails. */
  sendPart: (n: number, onBytes: (sent: number) => void) => Promise<void>
  /** 0–1 of the whole file. */
  onProgress?: (fraction: number) => void
  /** Stops starting new tries (an AbortError ends the upload at once). */
  signal?: AbortSignal
  wait?: (ms: number) => Promise<void>
  concurrency?: number
  attempts?: number
}

/** Sends every part not yet done. Resolves when all are stored; rejects with the last error once a part has used up its tries. */
export async function sendParts(job: PartsJob): Promise<void> {
  const wait = job.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const attempts = job.attempts ?? PART_ATTEMPTS
  const inFlight = new Map<number, number>()
  const doneBytes = () => [...job.done].reduce((sum, n) => sum + (partRange(job.size, job.partSize, n)[1] - partRange(job.size, job.partSize, n)[0]), 0)
  const report = () => job.onProgress?.(Math.min(1, (doneBytes() + [...inFlight.values()].reduce((a, b) => a + b, 0)) / job.size))

  const queue = Array.from({ length: job.partCount }, (_, i) => i + 1).filter((n) => !job.done.has(n))
  let failure: unknown = null
  report()

  async function worker() {
    while (queue.length && !failure) {
      const n = queue.shift()!
      for (let attempt = 1; ; attempt++) {
        if (job.signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')
        await wait(retryDelayMs(attempt))
        try {
          inFlight.set(n, 0)
          await job.sendPart(n, (sent) => {
            inFlight.set(n, sent)
            report()
          })
          inFlight.delete(n)
          job.done.add(n)
          report()
          break
        } catch (err) {
          inFlight.delete(n)
          if ((err as Error)?.name === 'AbortError') throw err
          if (attempt >= attempts) {
            failure = err
            return
          }
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(job.concurrency ?? PART_CONCURRENCY, queue.length || 1) }, worker))
  if (failure) throw failure
}
