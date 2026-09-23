import { afterEach, describe, expect, it } from 'vitest'
import { CJK_SUBTITLE_RULES, DEFAULT_SUBTITLE_RULES, defaultSubtitleRules, setSubtitleRuleDefaults } from './subtitleRules'

afterEach(() => setSubtitleRuleDefaults({ standardRules: DEFAULT_SUBTITLE_RULES, compactRules: CJK_SUBTITLE_RULES, compactLanguages: ['ja', 'zh'] }))

describe('defaultSubtitleRules', () => {
  it('uses the built-in rules until settings load', () => {
    expect(defaultSubtitleRules('en').maxCharsPerLine).toBe(42)
    expect(defaultSubtitleRules('zh-TW').maxCharsPerLine).toBe(16)
  })

  it('follows the configured rules and compact languages', () => {
    setSubtitleRuleDefaults({
      standardRules: { ...DEFAULT_SUBTITLE_RULES, maxCharsPerLine: 40 },
      compactRules: { ...CJK_SUBTITLE_RULES, maxCharsPerLine: 14 },
      compactLanguages: ['ja', 'KO']
    })
    expect(defaultSubtitleRules('en').maxCharsPerLine).toBe(40)
    expect(defaultSubtitleRules('ko').maxCharsPerLine).toBe(14)
    expect(defaultSubtitleRules('zh').maxCharsPerLine).toBe(40)
  })

  it('returns a copy', () => {
    const r = defaultSubtitleRules('en')
    r.maxLines = 9
    expect(defaultSubtitleRules('en').maxLines).toBe(2)
  })
})
