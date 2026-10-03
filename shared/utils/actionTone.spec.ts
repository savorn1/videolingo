import { describe, expect, it } from 'vitest'
import { ACTION_TONES, actionIconClass, type ActionTone } from './actionTone'

const tones = Object.keys(ACTION_TONES) as ActionTone[]

describe('action tones', () => {
  it('give every tone an icon and a button look, each in its own colour', () => {
    for (const t of tones) {
      expect(ACTION_TONES[t].icon, t).toContain(`text-${t}-600`)
      expect(ACTION_TONES[t].icon, t).toContain(`dark:text-${t}-400`)
      expect(ACTION_TONES[t].button, t).toContain(`bg-${t}-50`)
      expect(ACTION_TONES[t].button, t).toContain(`dark:bg-${t}-950`)
    }
    expect(new Set(tones.map((t) => ACTION_TONES[t].icon)).size).toBe(tones.length)
  })
  it('has no icon class for an action without a tone', () => {
    expect(actionIconClass(undefined)).toBeUndefined()
    expect(actionIconClass('sky')).toBe(ACTION_TONES.sky.icon)
  })
})
