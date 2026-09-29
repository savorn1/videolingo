// A deterministic (hashed-from-name) palette for initials avatars — the same
// person always lands on the same colour everywhere in the app (user list,
// user detail, nav bar, "assigned to" chips) without storing a preference.
const AVATAR_COLOR_CLASSES = [
  'bg-sky-100 dark:bg-sky-400/20 text-sky-700 dark:text-sky-300',
  'bg-violet-100 dark:bg-violet-400/20 text-violet-700 dark:text-violet-300',
  'bg-teal-100 dark:bg-teal-400/20 text-teal-700 dark:text-teal-300',
  'bg-orange-100 dark:bg-orange-400/20 text-orange-700 dark:text-orange-300',
  'bg-emerald-100 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-300',
  'bg-indigo-100 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300',
  'bg-rose-100 dark:bg-rose-400/20 text-rose-700 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-400/20 text-amber-700 dark:text-amber-300'
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function avatarColorClasses(name: string | null | undefined): string {
  if (!name) return AVATAR_COLOR_CLASSES[0]!
  return AVATAR_COLOR_CLASSES[hashString(name) % AVATAR_COLOR_CLASSES.length]!
}

export function avatarInitials(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts.length === 1 ? parts[0]!.slice(0, 2).toUpperCase() : (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}
