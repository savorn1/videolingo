import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANALYTICS_ACCENTS, type AnalyticsAreaKey } from './analyticsAccent'

const css = readFileSync(resolve(process.cwd(), 'app/assets/css/main.css'), 'utf8')
const areas = Object.keys(ANALYTICS_ACCENTS) as AnalyticsAreaKey[]

describe('ANALYTICS_ACCENTS', () => {
  it('has a scope rule in main.css, in light and dark, for every area', () => {
    for (const a of areas) {
      const scope = ANALYTICS_ACCENTS[a].scope
      expect(css, a).toContain(`.${scope} {`)
      expect(css, `${a} dark`).toContain(`.dark .${scope} {`)
    }
  })
  it('gives every area its own colour', () => {
    expect(new Set(areas.map((a) => ANALYTICS_ACCENTS[a].scope)).size).toBe(areas.length)
  })
  it('covers every area the Analytics page has', () => {
    expect(areas.sort()).toEqual(['ai', 'languages', 'storage', 'translations', 'users', 'videos', 'watch'])
  })
})
