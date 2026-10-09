import { describe, expect, it } from 'vitest'
import { GO_SEQUENCE_MS, GO_SHORTCUTS, goShortcutHelp, goShortcutsFor, goShortcutTarget } from './goShortcuts'

describe('goShortcutsFor', () => {
  it('leaves the admin pages out for learners', () => {
    expect(goShortcutsFor(false).map((s) => s.to)).toEqual(['/learn', '/profile'])
    expect(goShortcutsFor(true)).toHaveLength(GO_SHORTCUTS.length)
  })
  it('uses each letter once', () => {
    expect(new Set(GO_SHORTCUTS.map((s) => s.key)).size).toBe(GO_SHORTCUTS.length)
  })
})

describe('goShortcutTarget', () => {
  const all = goShortcutsFor(true)
  it('goes where the letter after g says', () => {
    expect(goShortcutTarget(1000, 1500, 'v', false, all)).toBe('/videos')
    expect(goShortcutTarget(1000, 1500, 'V', false, all)).toBe('/videos')
  })
  it('needs a g first, soon enough, without modifiers, and a known letter', () => {
    expect(goShortcutTarget(null, 1500, 'v', false, all)).toBeNull()
    expect(goShortcutTarget(1000, 1000 + GO_SEQUENCE_MS + 1, 'v', false, all)).toBeNull()
    expect(goShortcutTarget(1000, 1500, 'v', true, all)).toBeNull()
    expect(goShortcutTarget(1000, 1500, 'z', false, all)).toBeNull()
  })
  it('only goes to pages this account can open', () => {
    expect(goShortcutTarget(1000, 1500, 'v', false, goShortcutsFor(false))).toBeNull()
  })
})

describe('goShortcutHelp', () => {
  it('lists ? and each shortcut', () => {
    expect(goShortcutHelp(goShortcutsFor(false))).toEqual([
      { keys: '?', label: 'Show the keyboard shortcuts' },
      { keys: 'g l', label: 'Go to Learn' },
      { keys: 'g p', label: 'Go to Profile' }
    ])
  })
})
