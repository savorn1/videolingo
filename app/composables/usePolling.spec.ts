import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { usePolling } from './usePolling'

let visibility: DocumentVisibilityState = 'visible'
let online = true
function setOnline(v: boolean) {
  online = v
  window.dispatchEvent(new Event(v ? 'online' : 'offline'))
}
function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

function mountPolling(tick: () => unknown, options: Parameters<typeof usePolling>[1]) {
  const el = document.createElement('div')
  const app = createApp(
    defineComponent({
      setup() {
        usePolling(tick, options)
        return () => null
      }
    })
  )
  app.mount(el)
  return app
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  online = true
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('usePolling', () => {
  it('waits one interval, then keeps polling', async () => {
    const tick = vi.fn()
    const app = mountPolling(tick, { intervalMs: 1000 })
    expect(tick).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(tick).toHaveBeenCalledTimes(3)
    app.unmount()
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).toHaveBeenCalledTimes(3)
  })

  it('runs at once when asked to', async () => {
    const tick = vi.fn()
    mountPolling(tick, { intervalMs: 1000, immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('only polls while active', async () => {
    const tick = vi.fn()
    const on = ref(false)
    mountPolling(tick, { intervalMs: 1000, active: () => on.value })
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).not.toHaveBeenCalled()
    on.value = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(1)
    on.value = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('does not start another call while one is still running', async () => {
    let finish!: () => void
    const tick = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    mountPolling(tick, { intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).toHaveBeenCalledTimes(1)
    finish()
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('pauses while the tab is hidden and catches up when it is back', async () => {
    const tick = vi.fn()
    mountPolling(tick, { intervalMs: 1000 })
    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).not.toHaveBeenCalled()
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('waits longer after failures, and goes back to normal after a success', async () => {
    let fail = true
    const tick = vi.fn(async () => {
      if (fail) throw new Error('down')
    })
    mountPolling(tick, { intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000) // 1st call fails
    await vi.advanceTimersByTimeAsync(1999)
    expect(tick).toHaveBeenCalledTimes(1) // next one waits 2 s
    await vi.advanceTimersByTimeAsync(1) // 2nd call fails
    expect(tick).toHaveBeenCalledTimes(2)
    fail = false
    await vi.advanceTimersByTimeAsync(4000) // waits 4 s, succeeds
    expect(tick).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(1000) // back to 1 s
    expect(tick).toHaveBeenCalledTimes(4)
  })

  it('pauses while offline and catches up when the connection is back', async () => {
    const tick = vi.fn()
    mountPolling(tick, { intervalMs: 1000 })
    setOnline(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(tick).not.toHaveBeenCalled()
    setOnline(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(tick).toHaveBeenCalledTimes(1)
  })
})
