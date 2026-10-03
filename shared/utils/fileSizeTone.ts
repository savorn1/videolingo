// A file's size as a colour, so a long list can be scanned for the heavy ones: small files sky blue,
// medium amber, large rose. The text is the 800 shade on a pale fill (above 4.5:1).

export const MEDIUM_FILE_BYTES = 50 * 1024 * 1024
export const LARGE_FILE_BYTES = 500 * 1024 * 1024

export type FileSizeClass = 'unknown' | 'small' | 'medium' | 'large'

export function fileSizeClass(bytes: number | null | undefined): FileSizeClass {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'unknown'
  if (bytes >= LARGE_FILE_BYTES) return 'large'
  if (bytes >= MEDIUM_FILE_BYTES) return 'medium'
  return 'small'
}

const TONES: Record<FileSizeClass, string> = {
  unknown: 'text-gray-500 dark:text-gray-400',
  small: 'bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  medium: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
  large: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
}

export function fileSizeTone(bytes: number | null | undefined): string {
  return TONES[fileSizeClass(bytes)]
}
