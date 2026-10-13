import { describe, expect, it } from 'vitest'
import { shuttleKey } from './shuttle'

describe('shuttleKey', () => {
  it('L plays, then each press is faster, up to 4×', () => {
    expect(shuttleKey('L', { playing: false, rate: 1 })).toEqual({ play: true, rate: 1 })
    expect(shuttleKey('L', { playing: true, rate: 1 })).toEqual({ play: true, rate: 1.5 })
    expect(shuttleKey('L', { playing: true, rate: 2 })).toEqual({ play: true, rate: 4 })
    expect(shuttleKey('L', { playing: true, rate: 4 })).toEqual({ play: true, rate: 4 })
    // A speed picked in the menu between the steps goes to the next step.
    expect(shuttleKey('L', { playing: true, rate: 1.25 })).toEqual({ play: true, rate: 1.5 })
  })
  it('J slows down while fast, then jumps back', () => {
    expect(shuttleKey('J', { playing: true, rate: 4 })).toEqual({ play: true, rate: 2 })
    expect(shuttleKey('J', { playing: true, rate: 1.5 })).toEqual({ play: true, rate: 1 })
    expect(shuttleKey('J', { playing: true, rate: 1 })).toEqual({ skipSeconds: -10 })
    expect(shuttleKey('J', { playing: false, rate: 2 })).toEqual({ skipSeconds: -10 })
  })
  it('K pauses at normal speed', () => {
    expect(shuttleKey('K', { playing: true, rate: 4 })).toEqual({ play: false, rate: 1 })
  })
})
