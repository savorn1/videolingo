import { describe, expect, it } from 'vitest'
import { TAB_ORDER, tabForKey } from './tabKeys'

describe('tabForKey', () => {
  it('opens the tabs in the order shown', () => {
    expect(['1', '2', '3', '4', '5'].map(tabForKey)).toEqual(['trim', 'split', 'audio', 'overlay', 'join'])
    expect(TAB_ORDER).toHaveLength(5)
  })

  it('ignores other keys', () => {
    for (const key of ['0', '6', '9', '10', 'a', ' ', 'Enter', '!']) expect(tabForKey(key)).toBeNull()
  })
})
