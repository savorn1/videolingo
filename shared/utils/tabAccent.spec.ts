import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TAB_ACCENTS, type EditorTab } from './tabAccent'

// The accents are plain class strings and the scope rules are hand-written CSS in
// main.css, so nothing ties the two together except this test.
const css = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')
const tabs = Object.keys(TAB_ACCENTS) as EditorTab[]

describe('TAB_ACCENTS', () => {
  it('has every field filled in for every tab', () => {
    for (const tab of tabs) {
      for (const [field, value] of Object.entries(TAB_ACCENTS[tab])) expect(value, `${tab}.${field}`).toBeTruthy()
    }
  })
  it('has a scope rule in main.css, in light and dark, for every tab', () => {
    for (const tab of tabs) {
      const scope = TAB_ACCENTS[tab].scope
      expect(css, scope).toContain(`.${scope} {`)
      expect(css, `.dark ${scope}`).toContain(`.dark .${scope} {`)
    }
  })
  it('uses a different colour for every tab', () => {
    expect(new Set(tabs.map((t) => TAB_ACCENTS[t].scope)).size).toBe(tabs.length)
  })
  it('points each scope at its own colour', () => {
    for (const tab of tabs) {
      const colour = TAB_ACCENTS[tab].scope.replace('tab-scope-', '')
      expect(TAB_ACCENTS[tab].button, tab).toContain(`bg-${colour}-`)
      expect(css).toContain(`.${TAB_ACCENTS[tab].scope} {\n  --ui-color-primary-50: var(--color-${colour}-50);`)
    }
  })
})
