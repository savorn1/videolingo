// "Go to" shortcuts anywhere in the app: g, then a letter (see shared/utils/goShortcuts.ts). Mounted once, in the layout.
import { goShortcutsFor, goShortcutTarget } from '#shared/utils/goShortcuts'

export function useGoShortcuts() {
  const { hasAnyAccess } = useAuth()
  let gPressedAt: number | null = null

  function isTyping(target: EventTarget | null) {
    const el = target as HTMLElement | null
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  }
  function onKeyDown(e: KeyboardEvent) {
    // A page or dialog that handled the key (the editor's own shortcuts, a menu) has the last word.
    if (e.defaultPrevented || isTyping(e.target) || e.repeat) return
    const modifiers = e.metaKey || e.ctrlKey || e.altKey
    const to = goShortcutTarget(gPressedAt, Date.now(), e.key, modifiers, goShortcutsFor(hasAnyAccess.value))
    if (to) {
      gPressedAt = null
      e.preventDefault()
      navigateTo(to)
      return
    }
    gPressedAt = !modifiers && e.key.toLowerCase() === 'g' ? Date.now() : null
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
