// Number keys open the editor's tabs, in the order they are shown: 1 Trim … 5 Join.
import type { EditorTab } from './tabAccent'

export const TAB_ORDER: readonly EditorTab[] = ['trim', 'split', 'audio', 'overlay', 'join']

/** The tab a key opens ('1'–'5'), or null for any other key. */
export function tabForKey(key: string): EditorTab | null {
  if (!/^[1-9]$/.test(key)) return null
  return TAB_ORDER[Number(key) - 1] ?? null
}
