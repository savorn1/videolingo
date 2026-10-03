// Emoji stickers for the Text & overlay tab. The backend only knows TEXT and
// IMAGE layers, so a sticker is drawn to a PNG in the browser, uploaded like any
// other image and added as an IMAGE layer.

export interface StickerGroup {
  label: string
  items: { emoji: string; name: string }[]
}

export const STICKER_GROUPS: StickerGroup[] = [
  {
    label: 'Reactions',
    items: [
      { emoji: '👍', name: 'thumbs up' },
      { emoji: '👏', name: 'clapping' },
      { emoji: '🔥', name: 'fire' },
      { emoji: '❤️', name: 'heart' },
      { emoji: '😂', name: 'laughing' },
      { emoji: '😍', name: 'heart eyes' },
      { emoji: '😮', name: 'surprised' },
      { emoji: '🎉', name: 'party' }
    ]
  },
  {
    label: 'Marks',
    items: [
      { emoji: '✅', name: 'check' },
      { emoji: '❌', name: 'cross' },
      { emoji: '⭐', name: 'star' },
      { emoji: '💡', name: 'idea' },
      { emoji: '⚠️', name: 'warning' },
      { emoji: '❓', name: 'question' },
      { emoji: '❗', name: 'exclamation' },
      { emoji: '📌', name: 'pin' }
    ]
  },
  {
    label: 'Pointers',
    items: [
      { emoji: '👉', name: 'point right' },
      { emoji: '👆', name: 'point up' },
      { emoji: '👇', name: 'point down' },
      { emoji: '👈', name: 'point left' },
      { emoji: '➡️', name: 'arrow right' },
      { emoji: '⬆️', name: 'arrow up' },
      { emoji: '🔔', name: 'bell' },
      { emoji: '🎯', name: 'target' }
    ]
  },
  {
    label: 'Faces',
    items: [
      { emoji: '😀', name: 'grin' },
      { emoji: '😊', name: 'smile' },
      { emoji: '😎', name: 'cool' },
      { emoji: '🤔', name: 'thinking' },
      { emoji: '😢', name: 'crying' },
      { emoji: '😡', name: 'angry' },
      { emoji: '🥳', name: 'celebrating' },
      { emoji: '🤯', name: 'mind blown' },
      { emoji: '😴', name: 'sleeping' },
      { emoji: '🙏', name: 'thanks' },
      { emoji: '🤩', name: 'star struck' },
      { emoji: '😱', name: 'scared' }
    ]
  },
  {
    label: 'Learning',
    items: [
      { emoji: '📚', name: 'books' },
      { emoji: '📝', name: 'memo' },
      { emoji: '✏️', name: 'pencil' },
      { emoji: '🎓', name: 'graduation' },
      { emoji: '🧠', name: 'brain' },
      { emoji: '🔍', name: 'magnifier' },
      { emoji: '🗣️', name: 'speaking' },
      { emoji: '👂', name: 'listening' },
      { emoji: '🌍', name: 'world' },
      { emoji: '💬', name: 'speech bubble' },
      { emoji: '🏆', name: 'trophy' },
      { emoji: '💯', name: 'hundred' }
    ]
  },
  {
    label: 'Media',
    items: [
      { emoji: '🎬', name: 'clapperboard' },
      { emoji: '🎵', name: 'music note' },
      { emoji: '🎧', name: 'headphones' },
      { emoji: '🎤', name: 'microphone' },
      { emoji: '📺', name: 'television' },
      { emoji: '▶️', name: 'play' },
      { emoji: '⏸️', name: 'pause' },
      { emoji: '🔊', name: 'speaker' },
      { emoji: '🔇', name: 'muted' },
      { emoji: '📷', name: 'camera' },
      { emoji: '🔴', name: 'red circle' },
      { emoji: '⏰', name: 'alarm clock' }
    ]
  },
  {
    label: 'Fun',
    items: [
      { emoji: '🚀', name: 'rocket' },
      { emoji: '✨', name: 'sparkles' },
      { emoji: '🌟', name: 'glowing star' },
      { emoji: '💥', name: 'boom' },
      { emoji: '🌈', name: 'rainbow' },
      { emoji: '☀️', name: 'sun' },
      { emoji: '🌙', name: 'moon' },
      { emoji: '🎁', name: 'gift' },
      { emoji: '🎈', name: 'balloon' },
      { emoji: '👑', name: 'crown' },
      { emoji: '💎', name: 'gem' },
      { emoji: '🍀', name: 'clover' }
    ]
  }
]

/** Side of the PNG a sticker is drawn at; layers are scaled by width %, so this only sets sharpness. */
export const STICKER_PX = 256

/** Upload name for a sticker, e.g. `sticker-fire.png`. */
export function stickerFileName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `sticker-${slug || 'emoji'}.png`
}

/** Draws an emoji centred on a transparent square canvas and returns it as a PNG file. */
export async function renderSticker(emoji: string, name: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = STICKER_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot draw stickers')
  ctx.font = `${Math.round(STICKER_PX * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, STICKER_PX / 2, STICKER_PX / 2 + STICKER_PX * 0.04)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not draw the sticker')
  return new File([blob], stickerFileName(name), { type: 'image/png' })
}

export const MAX_RECENT_STICKERS = 8

/** Groups narrowed to stickers whose name (or group) contains the query; empty groups are dropped. */
export function filterStickerGroups(groups: StickerGroup[], query: string): StickerGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map((g) => ({ label: g.label, items: g.label.toLowerCase().includes(q) ? g.items : g.items.filter((i) => i.name.includes(q) || i.emoji === q) }))
    .filter((g) => g.items.length)
}

/** Puts a sticker first in the recent list, without repeats, capped at MAX_RECENT_STICKERS. */
export function pushRecentSticker(recent: { emoji: string; name: string }[], sticker: { emoji: string; name: string }) {
  return [sticker, ...recent.filter((r) => r.emoji !== sticker.emoji)].slice(0, MAX_RECENT_STICKERS)
}

/** Reads a stored recent list, ignoring anything that isn't a well-formed sticker. */
export function sanitizeRecentStickers(raw: unknown): { emoji: string; name: string }[] {
  if (!Array.isArray(raw)) return []
  const out: { emoji: string; name: string }[] = []
  for (const r of raw) {
    if (r && typeof r.emoji === 'string' && typeof r.name === 'string' && r.emoji && r.emoji.length <= 16 && !out.some((o) => o.emoji === r.emoji)) {
      out.push({ emoji: r.emoji, name: r.name.slice(0, 40) })
    }
  }
  return out.slice(0, MAX_RECENT_STICKERS)
}

/** True when the text is a single emoji (one grapheme with a pictographic character), for the "your own" box. */
export function isSingleEmoji(text: string) {
  const t = text.trim()
  if (!t || !/\p{Extended_Pictographic}/u.test(t)) return false
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<unknown> } }).Segmenter
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(t)].length === 1 : [...t].length <= 8
}
