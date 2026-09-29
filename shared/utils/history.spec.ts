import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, createHistory, current, record, redo, undo } from './history'

describe('history', () => {
  it('undoes and redoes through recorded snapshots', () => {
    let h = createHistory('a')
    h = record(h, 'b')
    h = record(h, 'c')
    expect(current(h)).toBe('c')
    h = undo(h)
    expect(current(h)).toBe('b')
    h = undo(h)
    expect(current(h)).toBe('a')
    expect(canUndo(h)).toBe(false)
    h = redo(h)
    expect(current(h)).toBe('b')
    expect(canRedo(h)).toBe(true)
  })

  it('ignores a repeat of the current snapshot', () => {
    const h = record(createHistory('a'), 'a')
    expect(h.entries).toEqual(['a'])
  })

  it('drops the redo branch when something new is recorded', () => {
    let h = record(record(createHistory('a'), 'b'), 'c')
    h = record(undo(undo(h)), 'x')
    expect(h.entries).toEqual(['a', 'x'])
    expect(canRedo(h)).toBe(false)
  })

  it('keeps at most the limit, dropping the oldest', () => {
    let h = createHistory('0')
    for (let i = 1; i <= 5; i++) h = record(h, String(i), 3)
    expect(h.entries).toEqual(['3', '4', '5'])
    expect(current(h)).toBe('5')
    expect(undo(undo(h)).index).toBe(0)
  })

  it('does nothing past either end', () => {
    const h = createHistory('a')
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
})
