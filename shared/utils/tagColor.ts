// A tag keeps one colour everywhere it shows (the tags list, a video's tags, the tag picker),
// worked out from its name so nothing has to be stored: same name, same colour. Case doesn't
// matter ("Grammar" and "grammar" are the same tag). Text is the 800 shade on a 100 fill —
// above 4.5:1 — and the "#" is a shade lighter so the name stays the strongest part.

export interface TagTone {
  /** Fill and text for the chip. */
  chip: string
  /** The leading "#". */
  hash: string
}

const TONES: TagTone[] = [
  { chip: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', hash: 'text-sky-600 dark:text-sky-400' },
  { chip: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200', hash: 'text-violet-600 dark:text-violet-400' },
  { chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', hash: 'text-emerald-600 dark:text-emerald-400' },
  { chip: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', hash: 'text-rose-600 dark:text-rose-400' },
  { chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200', hash: 'text-amber-600 dark:text-amber-400' },
  { chip: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200', hash: 'text-teal-600 dark:text-teal-400' },
  { chip: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200', hash: 'text-indigo-600 dark:text-indigo-400' },
  { chip: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200', hash: 'text-orange-600 dark:text-orange-400' }
]

export const TAG_TONE_COUNT = TONES.length

function hashName(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/** The colour of a tag, from its name. */
export function tagTone(name: string | null | undefined): TagTone {
  const key = (name ?? '').trim().toLowerCase()
  return TONES[hashName(key) % TONES.length]!
}
