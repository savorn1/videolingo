import { describe, expect, it } from 'vitest'
import { diffTimedLines, summarizeDiff } from './revisionDiff'

const l = (startMs: number, endMs: number, text: string) => ({ startMs, endMs, text })

describe('diffTimedLines', () => {
  it('reports nothing for identical lists', () => {
    const lines = [l(0, 1000, 'a'), l(1000, 2000, 'b')]
    expect(summarizeDiff(diffTimedLines(lines, lines))).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 2 })
  })

  it('pairs a reworded cue as changed', () => {
    const rows = diffTimedLines([l(0, 1000, 'Helo'), l(1000, 2000, 'b')], [l(0, 1000, 'Hello'), l(1000, 2000, 'b')])
    expect(rows[0]).toMatchObject({ type: 'changed', before: { text: 'Helo' }, after: { text: 'Hello' } })
    expect(summarizeDiff(rows)).toEqual({ added: 0, removed: 0, changed: 1, unchanged: 1 })
  })

  it('pairs a retimed cue as changed', () => {
    const rows = diffTimedLines([l(0, 1000, 'a')], [l(0, 1500, 'a')])
    expect(rows).toEqual([{ type: 'changed', before: l(0, 1000, 'a'), after: l(0, 1500, 'a') }])
  })

  it('finds insertions and deletions', () => {
    const rows = diffTimedLines([l(0, 1, 'a'), l(1, 2, 'b'), l(2, 3, 'c')], [l(0, 1, 'a'), l(2, 3, 'c'), l(3, 4, 'd')])
    expect(summarizeDiff(rows)).toEqual({ added: 1, removed: 1, changed: 0, unchanged: 2 })
  })
})
