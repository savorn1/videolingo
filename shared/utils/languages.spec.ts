import { afterEach, describe, expect, it } from 'vitest'
import { FALLBACK_LANGUAGES, defaultLanguageCode, languageLabel, languageOptions, setLanguageCatalog } from './languages'

afterEach(() => setLanguageCatalog(FALLBACK_LANGUAGES))

describe('language catalog', () => {
  it('labels from the fallback set before the backend catalog loads', () => {
    expect(languageLabel('ja')).toBe('Japanese')
    expect(defaultLanguageCode()).toBe('en')
  })

  it('switches to the loaded catalog, matching codes case-insensitively', () => {
    setLanguageCatalog([
      { code: 'pt-BR', name: 'Portuguese (Brazil)', enabled: true, isDefault: false },
      { code: 'km', name: 'Khmer', enabled: true, isDefault: true }
    ])
    expect(languageLabel('PT-br')).toBe('Portuguese (Brazil)')
    expect(languageLabel('ja')).toBe('JA')
    expect(defaultLanguageCode()).toBe('km')
  })

  it('offers only enabled languages, sorted by name', () => {
    setLanguageCatalog([
      { code: 'fr', name: 'French', enabled: true, isDefault: false },
      { code: 'de', name: 'German', enabled: false, isDefault: false },
      { code: 'en', name: 'English', enabled: true, isDefault: true }
    ])
    expect(languageOptions().map((o) => o.value)).toEqual(['en', 'fr'])
  })

  it("keeps a record's current language in the options even when disabled or unknown", () => {
    setLanguageCatalog([
      { code: 'en', name: 'English', enabled: true, isDefault: true },
      { code: 'de', name: 'German', enabled: false, isDefault: false }
    ])
    expect(languageOptions('de').at(-1)).toEqual({ label: 'German (disabled)', value: 'de' })
    expect(languageOptions('xx').at(-1)).toEqual({ label: 'XX', value: 'xx' })
    expect(languageOptions('EN')).toHaveLength(1)
  })
})
