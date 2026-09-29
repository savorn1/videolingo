// A hand-maintained list of what's shipped, newest first — the source for
// the "What's new" panel. Not generated from commits: add an entry here
// when something worth telling people about ships. `id` is a stable slug
// (never reused) so "seen up to" can be tracked without relying on dates.

export interface ChangelogEntry {
  id: string
  date: string // YYYY-MM-DD
  title: string
  description: string
  area: 'Editor' | 'Learning' | 'Admin'
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-09-29-shortcuts-focus-bulk',
    date: '2026-09-29',
    title: 'Bulk actions, and shortcuts are easier to find',
    description:
      'Tags, categories, glossaries, webhooks and subtitle tracks now support selecting several rows and acting on them at once. Every keyboard-shortcut area now has a "?" button that shows the full list.',
    area: 'Admin'
  },
  {
    id: '2026-09-28-overlay-templates',
    date: '2026-09-28',
    title: 'Reusable text & overlay templates',
    description:
      'Save a title card, watermark or banner layout once and reuse it on any video. Three starter templates ship with the editor, and layers now snap to each other while dragging.',
    area: 'Editor'
  },
  {
    id: '2026-09-28-audio-overlay-editors',
    date: '2026-09-28',
    title: 'Audio editing and text & overlay tools',
    description:
      'The video editor gained a full audio tab (clips, volume, noise reduction, background music) and a text & overlay tab (titles, watermarks, logos) alongside trim, crop and split.',
    area: 'Editor'
  },
  {
    id: '2026-09-27-practice-panel',
    date: '2026-09-27',
    title: 'Shadowing and dictation practice',
    description: 'The watch page now has a Practice panel: record yourself repeating a line, or type what you hear, and see a word-by-word check.',
    area: 'Learning'
  },
  {
    id: '2026-09-26-video-editor',
    date: '2026-09-26',
    title: 'Trim, crop and split videos in the admin',
    description: 'A new video editor page: drag to crop, trim a range, split into segments, and preview results before replacing the original file.',
    area: 'Editor'
  }
]

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? null
