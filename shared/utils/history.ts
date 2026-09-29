// Undo/redo over snapshots (JSON strings of the editor's state). Recording
// the same snapshot twice is ignored, and a new one after undoing drops the
// redo branch — the usual editor behaviour. Pure, so it's tested directly.

export interface History {
  /** Snapshots, oldest first; `index` is the one currently shown. */
  entries: string[]
  index: number
}

export const HISTORY_LIMIT = 100

export function createHistory(initial: string): History {
  return { entries: [initial], index: 0 }
}

export function record(h: History, snapshot: string, limit = HISTORY_LIMIT): History {
  if (h.entries[h.index] === snapshot) return h
  const entries = [...h.entries.slice(0, h.index + 1), snapshot]
  const overflow = Math.max(0, entries.length - limit)
  return { entries: entries.slice(overflow), index: entries.length - 1 - overflow }
}

export function canUndo(h: History) {
  return h.index > 0
}

export function canRedo(h: History) {
  return h.index < h.entries.length - 1
}

export function undo(h: History): History {
  return canUndo(h) ? { ...h, index: h.index - 1 } : h
}

export function redo(h: History): History {
  return canRedo(h) ? { ...h, index: h.index + 1 } : h
}

export function current(h: History): string {
  return h.entries[h.index]!
}
