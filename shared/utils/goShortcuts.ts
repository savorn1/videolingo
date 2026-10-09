// "Go to" keyboard shortcuts, anywhere in the app: press g, then a letter (as in Gmail or GitHub).

/** Pressing the letter this long after g still counts. */
export const GO_SEQUENCE_MS = 1500

export interface GoShortcut {
  key: string
  to: string
  label: string
  /** Only for accounts that can open the admin pages (useAuth().hasAnyAccess). */
  admin?: boolean
}

export const GO_SHORTCUTS: readonly GoShortcut[] = [
  { key: 'd', to: '/', label: 'Dashboard', admin: true },
  { key: 'l', to: '/learn', label: 'Learn' },
  { key: 'v', to: '/videos', label: 'Videos', admin: true },
  { key: 'c', to: '/collections', label: 'Collections', admin: true },
  { key: 's', to: '/subtitles', label: 'Subtitles', admin: true },
  { key: 'j', to: '/processing-jobs', label: 'Processing jobs', admin: true },
  { key: 'n', to: '/notifications', label: 'Notifications', admin: true },
  { key: 'p', to: '/profile', label: 'Profile' }
]

/** The shortcuts this account can use. */
export function goShortcutsFor(hasAdminAccess: boolean): GoShortcut[] {
  return GO_SHORTCUTS.filter((s) => hasAdminAccess || !s.admin)
}

/**
 * Where a key takes you, given when g was last pressed (null: not pressed): the page, or null.
 * The letter must come within GO_SEQUENCE_MS of the g, with no modifier held.
 */
export function goShortcutTarget(gPressedAt: number | null, now: number, key: string, modifiers: boolean, shortcuts: readonly GoShortcut[]): string | null {
  if (gPressedAt === null || modifiers || now - gPressedAt > GO_SEQUENCE_MS) return null
  return shortcuts.find((s) => s.key === key.toLowerCase())?.to ?? null
}

/** The shortcuts as the help list shows them ("g v" → "Go to Videos"), with "?" itself. */
export function goShortcutHelp(shortcuts: readonly GoShortcut[]): { keys: string; label: string }[] {
  return [{ keys: '?', label: 'Show the keyboard shortcuts' }, ...shortcuts.map((s) => ({ keys: `g ${s.key}`, label: `Go to ${s.label}` }))]
}
