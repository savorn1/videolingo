// Undo/redo for the video editor, plus a draft kept in this browser so a
// refresh doesn't lose unrendered work. The editor passes `take` (its state
// as plain data) and `apply` (put such data back); changes are recorded
// after they settle, so dragging a slider is one step, not hundreds.

import { canRedo, canUndo, createHistory, current, record, redo, undo, type History } from '#shared/utils/history'

export interface EditorDraft {
  /** The video file the draft was made against — a replaced file makes it stale. */
  videoUrl: string | null
  savedAt: number
  state: string
}

const SETTLE_MS = 400

export function useEditorHistory(options: {
  take: () => unknown
  apply: (state: any) => void | Promise<void>
  draftKey: () => string
  videoUrl: () => string | null
}) {
  const snapshot = computed(() => JSON.stringify(options.take()))
  const history = shallowRef<History>(createHistory(snapshot.value))
  const baseline = ref(snapshot.value)
  let applying = false
  let timer: ReturnType<typeof setTimeout> | undefined
  /** When the unrendered edits were last kept in this browser (null = nothing kept). */
  const draftSavedAt = ref<number | null>(null)

  const undoable = computed(() => canUndo(history.value))
  const redoable = computed(() => canRedo(history.value))

  function readDraft(): EditorDraft | null {
    try {
      const raw = localStorage.getItem(options.draftKey())
      return raw ? (JSON.parse(raw) as EditorDraft) : null
    } catch {
      return null
    }
  }
  function writeDraft(state: string) {
    try {
      if (state === baseline.value) {
        localStorage.removeItem(options.draftKey())
        draftSavedAt.value = null
      } else {
        const savedAt = Date.now()
        localStorage.setItem(options.draftKey(), JSON.stringify({ videoUrl: options.videoUrl(), savedAt, state } satisfies EditorDraft))
        draftSavedAt.value = savedAt
      }
    } catch {
      // Private mode / storage full: undo still works, the draft just isn't kept.
    }
  }

  watch(snapshot, (value) => {
    if (applying) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      history.value = record(history.value, value)
      writeDraft(value)
    }, SETTLE_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))

  async function show(state: string) {
    applying = true
    clearTimeout(timer)
    try {
      await options.apply(JSON.parse(state))
      await nextTick()
    } finally {
      applying = false
    }
    writeDraft(state)
  }

  async function doUndo() {
    if (!undoable.value) return
    history.value = undo(history.value)
    await show(current(history.value))
  }
  async function doRedo() {
    if (!redoable.value) return
    history.value = redo(history.value)
    await show(current(history.value))
  }

  /** Starts over from the editor's current state (after loading or reset): no history, no draft. */
  function start() {
    clearTimeout(timer)
    baseline.value = snapshot.value
    history.value = createHistory(snapshot.value)
  }

  /** A saved draft for this video file, if there is one worth offering. */
  function pendingDraft(): EditorDraft | null {
    const d = readDraft()
    return d && d.videoUrl === options.videoUrl() && d.state !== baseline.value ? d : null
  }

  async function restoreDraft(d: EditorDraft) {
    history.value = record(history.value, d.state)
    await show(d.state)
  }

  function discardDraft() {
    draftSavedAt.value = null
    try {
      localStorage.removeItem(options.draftKey())
    } catch {
      // Nothing stored.
    }
  }

  // Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y — except while typing, where they belong to the field.
  function onKey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return
    const t = e.target as HTMLElement | null
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
    const key = e.key.toLowerCase()
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      doUndo()
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      doRedo()
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { undo: doUndo, redo: doRedo, undoable, redoable, draftSavedAt, start, pendingDraft, restoreDraft, discardDraft }
}
