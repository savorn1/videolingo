import { describe, expect, it } from 'vitest'
import { diffWords, normalizeWord } from './wordDiff'

const shape = (r: ReturnType<typeof diffWords>) => r.tokens.map((t) => `${t.status}:${t.text}${t.expected ? `>${t.expected}` : ''}`)

describe('normalizeWord', () => {
  it('ignores case, punctuation and accents but keeps apostrophes inside words', () => {
    expect(normalizeWord('Café!')).toBe('cafe')
    expect(normalizeWord('"Don\'t,"')).toBe("don't")
    expect(normalizeWord('...')).toBe('')
  })
})

describe('diffWords', () => {
  it('scores a perfect answer, whatever the case and punctuation', () => {
    const r = diffWords('Where is the station?', 'where is the Station')
    expect(r.score).toBe(1)
    expect(shape(r)).toEqual(['ok:where', 'ok:is', 'ok:the', 'ok:Station'])
  })

  it('marks a wrong word with what was expected', () => {
    const r = diffWords('I would like a coffee', 'I would like the coffee')
    expect(shape(r)).toEqual(['ok:I', 'ok:would', 'ok:like', 'wrong:the>a', 'ok:coffee'])
    expect(r.correct).toBe(4)
    expect(r.score).toBeCloseTo(0.8)
  })

  it('marks missing and extra words', () => {
    expect(shape(diffWords('see you tomorrow morning', 'see you tomorrow'))).toEqual(['ok:see', 'ok:you', 'ok:tomorrow', 'missing:morning'])
    expect(shape(diffWords('thank you', 'thank you very much'))).toEqual(['ok:thank', 'ok:you', 'extra:very', 'extra:much'])
  })

  it('handles an empty answer', () => {
    const r = diffWords('hello there', '')
    expect(r.score).toBe(0)
    expect(shape(r)).toEqual(['missing:hello', 'missing:there'])
  })

  it('compares unspaced scripts character by character', () => {
    const r = diffWords('សួស្តី', 'សួស្តី')
    expect(r.score).toBe(1)
    expect(r.total).toBeGreaterThan(1)
    const partly = diffWords('你好吗', '你好')
    expect(shape(partly)).toEqual(['ok:你', 'ok:好', 'missing:吗'])
  })
})
