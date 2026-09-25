// Sentence-by-sentence playback for learners: where "previous / next line"
// go, and what to do when a line ends while looping it or pausing after each
// line. Works on subtitle cues (start/end in ms). Pure, so it's unit-tested.

export interface TimedCue {
  startMs: number
  endMs: number
}

/** Within this long after a line starts, "previous" goes to the line before; later, it restarts this one (like a music player). */
export const RESTART_GRACE_MS = 1500

/** Index of the line being spoken at `ms`, else the last one that started before it (-1 = none yet). */
export function lineAt(cues: TimedCue[], ms: number): number {
  let found = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i]!.startMs <= ms) found = i
    else break
  }
  return found
}

/** Where "previous line" jumps to, or null when there's nowhere to go. */
export function previousLineStart(cues: TimedCue[], ms: number): number | null {
  const i = lineAt(cues, ms)
  if (i < 0) return null
  const inGrace = ms - cues[i]!.startMs < RESTART_GRACE_MS
  if (inGrace) return i > 0 ? cues[i - 1]!.startMs : cues[i]!.startMs
  return cues[i]!.startMs
}

/** Where "next line" jumps to, or null after the last one. */
export function nextLineStart(cues: TimedCue[], ms: number): number | null {
  const next = cues.find((c) => c.startMs > ms + 1)
  return next ? next.startMs : null
}

/** Just after a line starts, "replay" means the line you just heard, not the one barely begun. */
export const REPLAY_GRACE_MS = 600

/**
 * Start of the line to replay: the current one — or, within REPLAY_GRACE_MS
 * of a new line starting (e.g. paused right at a boundary by "pause after
 * lines"), the one before it.
 */
export function currentLineStart(cues: TimedCue[], ms: number): number | null {
  const i = lineAt(cues, ms)
  if (i < 0) return null
  if (i > 0 && ms - cues[i]!.startMs < REPLAY_GRACE_MS && cues[i - 1]!.endMs >= cues[i]!.startMs - REPLAY_GRACE_MS) return cues[i - 1]!.startMs
  return cues[i]!.startMs
}

export type LineEndAction = { type: 'none' } | { type: 'loop'; toMs: number } | { type: 'pause'; line: number }

/**
 * Called on every time report. When playback crosses the end of line
 * `line` (the one being followed): loop mode jumps back to its start, pause
 * mode pauses once — `pausedLine` stops it pausing again on the same line.
 */
export function lineEndAction(
  cues: TimedCue[],
  line: number,
  ms: number,
  mode: { loop: boolean; pauseAfter: boolean },
  pausedLine: number | null
): LineEndAction {
  const cue = cues[line]
  if (!cue || ms < cue.endMs) return { type: 'none' }
  // Only react right at the end — a seek far past it isn't "finishing" the line.
  if (ms - cue.endMs > 1000) return { type: 'none' }
  if (mode.loop) return { type: 'loop', toMs: cue.startMs }
  if (mode.pauseAfter && pausedLine !== line) return { type: 'pause', line }
  return { type: 'none' }
}

/** WebVTT for the browser's own subtitle display (native full screen); a second language goes on the line below. */
export function cuesToVtt(cues: (TimedCue & { text: string })[], secondary: (TimedCue & { text: string })[] = []): string {
  const ts = (ms: number) => {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const s = Math.floor((ms % 60_000) / 1000)
    const f = Math.floor(ms % 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(3, '0')}`
  }
  const lines = ['WEBVTT', '']
  for (const c of cues) {
    const mid = (c.startMs + c.endMs) / 2
    const second = secondary.find((x) => x.startMs <= mid && mid < x.endMs)?.text
    // "-->" can't appear inside cue text; blank lines would end the cue.
    const clean = (t: string) =>
      t
        .replace(/-->/g, '→')
        .replace(/\n\s*\n/g, '\n')
        .trim()
    lines.push(`${ts(c.startMs)} --> ${ts(c.endMs)}`, clean(c.text) + (second ? `\n${clean(second)}` : ''), '')
  }
  return lines.join('\n')
}
