// Names for the editor's undo steps (the History list): what changed between one snapshot and the one before,
// from the parts of the state (useClipEditor takeState). Pure — tested with hand-made snapshots.

type State = Record<string, unknown>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Parts of the Trim tab and their names, in the order they're checked. */
const TRIM_PARTS: [string, string][] = [
  ['range', 'Trim range'],
  ['extend', 'Past the end'],
  ['cropOn', 'Crop'],
  ['crop', 'Crop'],
  ['cropAspect', 'Crop shape'],
  ['followAction', 'Follow the action'],
  ['scaleOn', 'Resize'],
  ['scale', 'Resize'],
  ['orient', 'Turn & flip'],
  ['cuts', 'Cut out'],
  ['look', 'Look'],
  ['motion', 'Motion & effects'],
  ['extras', 'Blur, picture in picture & cards'],
  ['audio', 'Sound on the trim']
]

/** Sound settings and their names. */
const SOUND_PARTS: [string, string][] = [
  ['source', 'source'],
  ['replacement', 'replacement'],
  ['clips', 'clips'],
  ['mutes', 'muted ranges'],
  ['volume', 'volume'],
  ['fadeInMs', 'fade in'],
  ['fadeOutMs', 'fade out'],
  ['normalize', 'loudness'],
  ['denoise', 'noise'],
  ['enhanceVoice', 'voice'],
  ['music', 'music'],
  ['tracks', 'sound tracks'],
  ['speed', 'speed'],
  ['keepSoundSpeed', 'speed'],
  ['pitchSemitones', 'pitch'],
  ['balance', 'balance'],
  ['channels', 'channels'],
  ['volumeCurve', 'volume curve'],
  ['preset', 'sound preset'],
  ['deEss', 'de-esser']
]

function changed(parts: [string, string][], before: State, after: State): string[] {
  const names: string[] = []
  for (const [key, name] of parts) if (!same(before[key], after[key]) && !names.includes(name)) names.push(name)
  return names
}

/** "Crop", "Sound: volume, fade out", "Added a layer"… — what one undo step changed; "Change" when it can't tell. */
export function describeStep(before: string, after: string): string {
  let a: State
  let b: State
  try {
    a = JSON.parse(before) as State
    b = JSON.parse(after) as State
  } catch {
    return 'Change'
  }
  const labels: string[] = []
  const trimA = (a.trim ?? {}) as State
  const trimB = (b.trim ?? {}) as State
  labels.push(...changed(TRIM_PARTS, trimA, trimB))
  if (!same(a.split, b.split)) labels.push('Split points')
  const sound = changed(SOUND_PARTS, (a.audio ?? {}) as State, (b.audio ?? {}) as State)
  if (sound.length) labels.push(`Sound: ${sound.slice(0, 2).join(', ')}${sound.length > 2 ? '…' : ''}`)
  const layersA = Array.isArray(a.overlay) ? a.overlay.length : 0
  const layersB = Array.isArray(b.overlay) ? b.overlay.length : 0
  if (layersB > layersA) labels.push(layersB - layersA === 1 ? 'Added a layer' : `Added ${layersB - layersA} layers`)
  else if (layersB < layersA) labels.push(layersA - layersB === 1 ? 'Removed a layer' : `Removed ${layersA - layersB} layers`)
  else if (!same(a.overlay, b.overlay)) labels.push('Layers')
  if (!same(a.captions, b.captions)) labels.push('Subtitles')
  if (!same(a.join, b.join)) labels.push('Join')
  if (!labels.length) return 'Change'
  return labels.length > 2 ? `${labels.slice(0, 2).join(' · ')} +${labels.length - 2}` : labels.join(' · ')
}

/** The History list: each snapshot's name ("Start" for the first), oldest first. */
export function historySteps(entries: string[]): string[] {
  return entries.map((e, i) => (i === 0 ? 'Start' : describeStep(entries[i - 1]!, e)))
}
