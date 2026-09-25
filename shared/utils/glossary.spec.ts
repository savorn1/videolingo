import { describe, expect, it } from 'vitest'
import { checkGlossary, containsGlossaryTerm, parseGlossaryLines } from './glossary'

describe('containsGlossaryTerm (mirrors backend GlossaryPrompt.contains)', () => {
  it('matches whole words in spaced scripts', () => {
    expect(containsGlossaryTerm('Open the Dashboard now', 'dashboard', false)).toBe(true)
    expect(containsGlossaryTerm("Let's start", 'art', false)).toBe(false)
    expect(containsGlossaryTerm('art, then more', 'art', false)).toBe(true)
  })

  it('respects case sensitivity', () => {
    expect(containsGlossaryTerm('apple pie', 'Apple', true)).toBe(false)
    expect(containsGlossaryTerm('Apple pie', 'Apple', true)).toBe(true)
  })

  it('matches inside unspaced scripts', () => {
    expect(containsGlossaryTerm('ខ្ញុំចូលចិត្តផ្ទាំងគ្រប់គ្រង', 'ផ្ទាំងគ្រប់គ្រង', false)).toBe(true)
    expect(containsGlossaryTerm('東京タワーに行く', '東京', false)).toBe(true)
  })
})

describe('checkGlossary', () => {
  const terms = [
    { source: 'dashboard', target: 'ផ្ទាំងគ្រប់គ្រង', doNotTranslate: false, caseSensitive: false, glossaryName: 'Product' },
    { source: 'VideoLingo', target: 'VideoLingo', doNotTranslate: true, caseSensitive: false }
  ]

  it('flags a source term left untranslated', () => {
    const hits = checkGlossary([{ text: 'បើក dashboard' }, { text: 'VideoLingo ល្អ' }], terms)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ cueIndex: 0, source: 'dashboard' })
    expect(hits[0]!.message).toContain('(Product)')
  })

  it('passes a cue that uses the required translation', () => {
    expect(checkGlossary([{ text: 'បើក ផ្ទាំងគ្រប់គ្រង (dashboard)' }], terms)).toEqual([])
  })
})

describe('parseGlossaryLines', () => {
  it('reads comma and tab lines, with keep-as-is terms', () => {
    const terms = parseGlossaryLines('# comment\ndashboard,ផ្ទាំងគ្រប់គ្រង,UI\n\nVideoLingo,=\nAPI\ninvoice\tវិក្កយបត្រ')
    expect(terms.map((t) => [t.source, t.target, t.doNotTranslate, t.note])).toEqual([
      ['dashboard', 'ផ្ទាំងគ្រប់គ្រង', false, 'UI'],
      ['VideoLingo', 'VideoLingo', true, null],
      ['API', 'API', true, null],
      ['invoice', 'វិក្កយបត្រ', false, null]
    ])
  })
})
