import { describe, expect, it } from 'vitest'
import { brandKitFrom, cardsFromKit, describeBrandKit, sanitizeBrandKit } from './brandKit'
import { PLAIN_EXTRAS } from './trimExtras'

const LOGO = { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', name: 'logo.png' }

describe('sanitizeBrandKit', () => {
  it('keeps a good kit and fills in what is missing', () => {
    expect(sanitizeBrandKit({ logo: LOGO, cardColor: '#ff0000', introText: 'Hi' })).toEqual({
      logo: LOGO,
      cardBackground: '#111827',
      cardColor: '#ff0000',
      introText: 'Hi',
      outroText: '',
      progressBar: null
    })
  })
  it('drops what is not a picture or a colour', () => {
    const kit = sanitizeBrandKit({ logo: { dataUrl: 'javascript:alert(1)', name: 'x' }, cardBackground: 'red', progressBar: '#12' })!
    expect([kit.logo, kit.cardBackground, kit.progressBar]).toEqual([null, '#111827', null])
    expect(sanitizeBrandKit(null)).toBeNull()
  })
})

describe('brandKitFrom and cardsFromKit', () => {
  const extras = {
    ...PLAIN_EXTRAS,
    cards: { intro: { text: 'Welcome', durationMs: 2000 }, outro: null, background: '#000000', color: '#ffcc00', logoKey: null, logoName: null },
    progressBar: '#ffcc00'
  }
  it('takes the current cards and bar', () => {
    expect(brandKitFrom(extras, LOGO)).toMatchObject({ introText: 'Welcome', outroText: '', cardBackground: '#000000', progressBar: '#ffcc00' })
  })
  it('puts the kit on the cards, keeping their lengths and the cards it has no words for', () => {
    const kit = { ...brandKitFrom(extras, null), introText: 'Hello', outroText: 'Bye' }
    expect(cardsFromKit(kit, extras.cards, { key: 'overlay-uploads/l.png', name: 'l.png' })).toEqual({
      intro: { text: 'Hello', durationMs: 2000 },
      outro: { text: 'Bye', durationMs: 3000 },
      background: '#000000',
      color: '#ffcc00',
      logoKey: 'overlay-uploads/l.png',
      logoName: 'l.png'
    })
    expect(cardsFromKit({ ...kit, outroText: '' }, null, null).outro).toBeNull()
  })
  it('says what a kit holds', () => {
    expect(describeBrandKit(brandKitFrom(extras, LOGO))).toBe('logo, card words, card colours, progress bar')
  })
})
