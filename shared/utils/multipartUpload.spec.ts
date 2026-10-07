import { describe, expect, it } from 'vitest'
import { partRange, retryDelayMs, sendParts } from './multipartUpload'

const noWait = () => Promise.resolve()

describe('partRange / retryDelayMs', () => {
  it('cuts the file into parts, the last one shorter', () => {
    expect(partRange(25, 10, 1)).toEqual([0, 10])
    expect(partRange(25, 10, 3)).toEqual([20, 25])
  })
  it('waits longer before each new try', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([0, 1000, 3000, 9000])
  })
})

describe('sendParts', () => {
  it('sends every part once and ends at 100 %', async () => {
    const sent: number[] = []
    const progress: number[] = []
    const done = new Set<number>()
    await sendParts({
      size: 25,
      partSize: 10,
      partCount: 3,
      done,
      wait: noWait,
      sendPart: async (n, onBytes) => {
        onBytes(5)
        sent.push(n)
      },
      onProgress: (f) => progress.push(f)
    })
    expect(sent.sort()).toEqual([1, 2, 3])
    expect([...done].sort()).toEqual([1, 2, 3])
    expect(progress.at(-1)).toBe(1)
  })

  it('retries a part that fails, then carries on', async () => {
    const tries: Record<number, number> = {}
    await sendParts({
      size: 20,
      partSize: 10,
      partCount: 2,
      done: new Set(),
      wait: noWait,
      sendPart: async (n) => {
        tries[n] = (tries[n] ?? 0) + 1
        if (n === 2 && tries[n] < 3) throw new Error('network')
      }
    })
    expect(tries).toEqual({ 1: 1, 2: 3 })
  })

  it('stops once a part has used its tries, keeping the parts that made it', async () => {
    const done = new Set<number>()
    await expect(
      sendParts({
        size: 30,
        partSize: 10,
        partCount: 3,
        done,
        wait: noWait,
        concurrency: 1,
        sendPart: async (n) => {
          if (n === 2) throw new Error('storage is down')
        }
      })
    ).rejects.toThrow('storage is down')
    expect(done.has(1)).toBe(true)
    expect(done.has(2)).toBe(false)
  })

  it('resumes: parts already done are not sent again', async () => {
    const sent: number[] = []
    await sendParts({
      size: 30,
      partSize: 10,
      partCount: 3,
      done: new Set([1, 2]),
      wait: noWait,
      sendPart: async (n) => {
        sent.push(n)
      }
    })
    expect(sent).toEqual([3])
  })

  it('ends at once when cancelled', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(
      sendParts({ size: 10, partSize: 10, partCount: 1, done: new Set(), wait: noWait, signal: abort.signal, sendPart: async () => {} })
    ).rejects.toThrow('cancelled')
  })
})
