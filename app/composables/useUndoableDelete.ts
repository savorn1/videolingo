// "X deleted — Undo" instead of only a confirm-before dialog. Works with any
// entity and needs no backend support: the row disappears from the list
// straight away (the caller does that), but the actual delete call is held
// back for a few seconds so "Undo" can cancel it before it ever happens.
const DEFAULT_DELAY_MS = 6000

export function useUndoableDelete() {
  const toast = useToast()

  /**
   * `commit` performs the real delete (only called if Undo isn't pressed);
   * `restore` puts the row back in the caller's list if it is. Call this
   * only after already removing the row from view — this doesn't do that
   * part, so the toast and the UI change together.
   */
  function del(label: string, options: { commit: () => Promise<unknown>; restore: () => void; delayMs?: number }) {
    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      try {
        await options.commit()
      } catch (err) {
        // The row's already gone from view; put it back rather than silently losing it.
        options.restore()
        toast.add({ title: `Could not delete ${label}`, description: apiErrorMessage(err), color: 'error' })
      }
    }, options.delayMs ?? DEFAULT_DELAY_MS)

    toast.add({
      title: `${label} deleted`,
      color: 'success',
      actions: [
        {
          label: 'Undo',
          onClick: () => {
            undone = true
            clearTimeout(timer)
            options.restore()
          }
        }
      ]
    })
  }

  return { del }
}
