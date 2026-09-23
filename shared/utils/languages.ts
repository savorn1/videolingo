// Spoken-language choices for videos, keyed by ISO 639-1 code (what the
// backend stores in Video.language). Not exhaustive — a video can carry any
// code; languageLabel() falls back to the raw code for ones not listed here.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'km', name: 'Khmer' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' }
]

export function languageLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase()
}

/** Select options; includes `current` even when it isn't in LANGUAGES, so editing never silently drops it. */
export function languageOptions(current?: string | null): { label: string; value: string | undefined }[] {
  const options: { label: string; value: string | undefined }[] = LANGUAGES.map((l) => ({ label: l.name, value: l.code }))
  if (current && !LANGUAGES.some((l) => l.code === current)) options.push({ label: current.toUpperCase(), value: current })
  return options
}
