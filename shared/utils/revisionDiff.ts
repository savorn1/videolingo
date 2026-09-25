// Line-by-line comparison of two versions of a subtitle track or transcript,
// for the version-history view.

export interface TimedLine {
  startMs: number
  endMs: number
  text: string
}

export type DiffRow =
  | { type: 'same'; before: TimedLine; after: TimedLine }
  | { type: 'changed'; before: TimedLine; after: TimedLine }
  | { type: 'removed'; before: TimedLine }
  | { type: 'added'; after: TimedLine }

export interface DiffSummary {
  added: number
  removed: number
  changed: number
  unchanged: number
}

// Past this many cells the LCS table gets too big for the browser; the
// comparison then just lines the two lists up by position.
const MAX_CELLS = 4_000_000

const key = (l: TimedLine) => `${l.startMs}|${l.endMs}|${l.text}`

/**
 * Longest-common-subsequence diff. A removed line directly followed by an
 * added one that shares its timing or its text is shown as one "changed"
 * row (a retimed or reworded cue) rather than two.
 */
export function diffTimedLines(before: TimedLine[], after: TimedLine[]): DiffRow[] {
  const n = before.length
  const m = after.length
  if (n * m > MAX_CELLS) return positional(before, after)
  const a = before.map(key)
  const b = after.map(key)
  // lcs[i][j] = LCS length of a[i..] and b[j..], flattened.
  const w = m + 1
  const lcs = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1]! + 1 : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!)
    }
  }
  const raw: DiffRow[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      raw.push({ type: 'same', before: before[i]!, after: after[j]! })
      i++
      j++
    } else if (lcs[(i + 1) * w + j]! >= lcs[i * w + j + 1]!) {
      raw.push({ type: 'removed', before: before[i++]! })
    } else {
      raw.push({ type: 'added', after: after[j++]! })
    }
  }
  while (i < n) raw.push({ type: 'removed', before: before[i++]! })
  while (j < m) raw.push({ type: 'added', after: after[j++]! })
  return pairChanges(raw)
}

function pairChanges(rows: DiffRow[]): DiffRow[] {
  const out: DiffRow[] = []
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k]!
    const next = rows[k + 1]
    if (row.type === 'removed' && next?.type === 'added') {
      const sameTiming = row.before.startMs === next.after.startMs && row.before.endMs === next.after.endMs
      if (sameTiming || row.before.text === next.after.text) {
        out.push({ type: 'changed', before: row.before, after: next.after })
        k++
        continue
      }
    }
    out.push(row)
  }
  return out
}

function positional(before: TimedLine[], after: TimedLine[]): DiffRow[] {
  const rows: DiffRow[] = []
  for (let k = 0; k < Math.max(before.length, after.length); k++) {
    const b = before[k]
    const a = after[k]
    if (b && a) rows.push(key(b) === key(a) ? { type: 'same', before: b, after: a } : { type: 'changed', before: b, after: a })
    else if (b) rows.push({ type: 'removed', before: b })
    else if (a) rows.push({ type: 'added', after: a })
  }
  return rows
}

export function summarizeDiff(rows: DiffRow[]): DiffSummary {
  const s: DiffSummary = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  for (const r of rows) {
    if (r.type === 'same') s.unchanged++
    else s[r.type]++
  }
  return s
}
