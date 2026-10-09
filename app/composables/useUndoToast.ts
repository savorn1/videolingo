// "Done — Undo" for actions the backend can reverse (trash ↔ restore, archive ↔ unarchive, enable ↔ disable):
// the change happens straight away, and Undo on the toast calls the opposite action. For deletes the backend
// can't reverse, useUndoableDelete holds the call back instead.
export function useUndoToast() {
  const toast = useToast()

  /**
   * Says `title` with an Undo button. `undo` runs the opposite action; then `undone` is said and `after` runs
   * (reload the list or page). A failed undo says `failed` with the reason.
   */
  function doneWithUndo(title: string, undo: { run: () => Promise<unknown>; undone: string; failed: string; after?: () => unknown }) {
    let used = false
    toast.add({
      title,
      color: 'success',
      actions: [
        {
          label: 'Undo',
          icon: 'i-lucide-undo-2',
          color: 'neutral',
          variant: 'outline',
          onClick: async () => {
            if (used) return
            used = true
            try {
              await undo.run()
              toast.add({ title: undo.undone, color: 'info' })
              await undo.after?.()
            } catch (err) {
              toast.add({ title: undo.failed, description: apiErrorMessage(err), color: 'error' })
            }
          }
        }
      ]
    })
  }

  return { doneWithUndo }
}
