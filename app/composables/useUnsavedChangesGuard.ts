// Stops half-finished work being thrown away by a navigation the page doesn't
// own. Detail pages already track `isDirty` and confirm before their *own* back
// button navigates — but that covers one exit out of four. Clicking a sidebar
// link, hitting browser back, refreshing, or closing the tab all bypassed it and
// silently discarded the form.
//
// A page opts in with one line:
//
//   useUnsavedChangesGuard(isDirty)
//
// In-app navigation is intercepted and routed through the app's own confirm
// dialog (rendered once by the default layout, see UnsavedChangesDialog), so it
// looks like every other confirm in the product. Leaving the site entirely falls
// back to the browser's native prompt, which is the only thing available there.

import type { Ref } from 'vue'

interface PendingLeave {
  resolve: (leave: boolean) => void
}

// Shared with UnsavedChangesDialog. useState rather than a module-level ref so
// it isn't carried between requests during SSR.
export function useUnsavedChangesPrompt() {
  return useState<PendingLeave | null>('unsaved-changes-prompt', () => null)
}

export function useUnsavedChangesGuard(isDirty: Ref<boolean> | (() => boolean)) {
  const prompt = useUnsavedChangesPrompt()
  const dirty = () => (typeof isDirty === 'function' ? isDirty() : isDirty.value)

  // Leaving the site (refresh, tab close, external link). The message is ignored
  // by modern browsers — setting returnValue is what triggers the native prompt.
  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty()) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    // A pending prompt belongs to the page that opened it; leave it resolved so
    // the dialog can't outlive its own page.
    prompt.value?.resolve(true)
    prompt.value = null
  })

  onBeforeRouteLeave(async () => {
    if (!dirty()) return true
    // Never stand in the way of a forced sign-out. useApi bounces to /login when a
    // session can't be refreshed, and prompting there is worse than useless: the
    // work is unrecoverable either way, and "keep editing" would cancel a
    // navigation the user can't actually avoid.
    if (!useAuth().isAuthenticated.value) return true
    // Never stack prompts — if one is already open, that navigation wins.
    if (prompt.value) return false
    const confirmed = await new Promise<boolean>((resolve) => {
      prompt.value = { resolve }
    })
    prompt.value = null
    return confirmed
  })
}
