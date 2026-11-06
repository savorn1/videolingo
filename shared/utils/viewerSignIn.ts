/** The ways a RuengFlix viewer signs in, as stored on their account (any may be missing) */
export interface ViewerSignIn {
  phone: string | null
  telegramLinked: boolean
  telegramUsername: string | null
  googleEmail: string | null
}

/** "012 345 678 · Telegram @dara · dara@gmail.com", for the Viewers list */
export function viewerSignInLabel(v: ViewerSignIn): string {
  const parts: string[] = []
  if (v.phone) parts.push(v.phone)
  if (v.telegramLinked) parts.push(v.telegramUsername ? `Telegram @${v.telegramUsername}` : 'Telegram')
  if (v.googleEmail) parts.push(v.googleEmail)
  return parts.join(' · ') || '—'
}
