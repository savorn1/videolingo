import { describe, expect, it } from 'vitest'
import { viewerSignInLabel } from './viewerSignIn'

const none = { phone: null, telegramLinked: false, telegramUsername: null, googleEmail: null }

describe('viewerSignInLabel', () => {
  it('lists every way in', () => {
    expect(viewerSignInLabel({ phone: '012 345 678', telegramLinked: true, telegramUsername: 'dara', googleEmail: 'dara@gmail.com' })).toBe(
      '012 345 678 · Telegram @dara · dara@gmail.com'
    )
  })

  it('names Telegram without a username', () => {
    expect(viewerSignInLabel({ ...none, telegramLinked: true })).toBe('Telegram')
  })

  it('falls back to a dash', () => {
    expect(viewerSignInLabel(none)).toBe('—')
  })
})
