// The title, artist and cover art written inside an audio file — ID3v2 tags in
// MP3s (versions 2.2–2.4), the iTunes-style "ilst" atoms in M4A/MP4 files — so
// Video from audio can fill in each video's title and picture by itself. Only
// what the page uses is read; anything unexpected gives up quietly. Pure (bytes
// in, tags out), so it's tested with hand-made files.

export interface AudioTags {
  title?: string
  artist?: string
  album?: string
  cover?: { mime: string; data: Uint8Array }
  /** Chapters written in the file (ID3 CHAP frames, as podcast tools write them), in time order. */
  chapters?: { startMs: number; title: string }[]
}

const latin1 = new TextDecoder('latin1')
const utf8 = new TextDecoder('utf-8')

function ascii(b: Uint8Array, at: number, n: number): string {
  return String.fromCharCode(...b.subarray(at, at + n))
}

function syncsafe(b: Uint8Array, at: number): number {
  return ((b[at]! & 0x7f) << 21) | ((b[at + 1]! & 0x7f) << 14) | ((b[at + 2]! & 0x7f) << 7) | (b[at + 3]! & 0x7f)
}

function uint32(b: Uint8Array, at: number): number {
  return ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!
}

/** The whole ID3v2 tag's length (header included) when `head` (the first 10 bytes) starts one; null otherwise. */
export function id3TagLength(head: Uint8Array): number | null {
  if (head.length < 10 || ascii(head, 0, 3) !== 'ID3') return null
  return 10 + syncsafe(head, 6) + (head[5]! & 0x10 ? 10 : 0)
}

/** Text in one of ID3's four encodings; the first value when several are separated by nulls. */
function decodeText(enc: number, b: Uint8Array): string {
  let text: string
  if (enc === 1 || enc === 2) {
    let le = enc === 1
    let start = 0
    if (enc === 1 && b.length >= 2) {
      if (b[0] === 0xff && b[1] === 0xfe) start = 2
      else if (b[0] === 0xfe && b[1] === 0xff) {
        le = false
        start = 2
      }
    }
    text = new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(b.subarray(start, start + ((b.length - start) & ~1)))
  } else {
    text = (enc === 3 ? utf8 : latin1).decode(b)
  }
  return text.split('\u0000')[0]!.trim()
}

/** Where a null-terminated string ends (index of the terminator), one or two zero bytes wide. */
function nullEnd(b: Uint8Array, from: number, wide: boolean): number {
  if (!wide) {
    const i = b.indexOf(0, from)
    return i === -1 ? b.length : i
  }
  for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i
  return b.length
}

const PIC_MIME: Record<string, string> = { JPG: 'image/jpeg', PNG: 'image/png' }

/** Reads an ID3v2 tag (the bytes from the start of the file, at least the whole tag). */
export function parseId3(buf: Uint8Array): AudioTags {
  const total = id3TagLength(buf)
  if (total === null) return {}
  const version = buf[3]!
  const flags = buf[5]!
  let body = buf.subarray(10, Math.min(buf.length, total))
  // Version 2.2/2.3 "unsynchronisation": every 0xFF 0x00 stands for 0xFF.
  if (flags & 0x80 && version < 4) {
    const out: number[] = []
    for (let i = 0; i < body.length; i++) {
      out.push(body[i]!)
      if (body[i] === 0xff && body[i + 1] === 0) i++
    }
    body = Uint8Array.from(out)
  }
  let pos = 0
  if (flags & 0x40 && version >= 3) pos = version === 4 ? syncsafe(body, 0) : 4 + uint32(body, 0)

  const tags: AudioTags = {}
  let coverType = -1
  const idLen = version === 2 ? 3 : 4
  const headLen = version === 2 ? 6 : 10
  while (pos + headLen <= body.length) {
    const id = ascii(body, pos, idLen)
    if (!/^[A-Z0-9]+$/.test(id)) break
    const size =
      version === 2 ? (body[pos + 3]! << 16) | (body[pos + 4]! << 8) | body[pos + 5]! : version === 4 ? syncsafe(body, pos + 4) : uint32(body, pos + 4)
    const data = body.subarray(pos + headLen, pos + headLen + size)
    pos += headLen + size
    if (!data.length) continue
    const enc = data[0]!
    if (id === 'CHAP' && version >= 3) {
      const chapter = parseChap(data, version)
      if (chapter) (tags.chapters ??= []).push(chapter)
      continue
    }
    if (id === 'TIT2' || id === 'TT2') tags.title ||= decodeText(enc, data.subarray(1)) || undefined
    else if (id === 'TPE1' || id === 'TP1') tags.artist ||= decodeText(enc, data.subarray(1)) || undefined
    else if (id === 'TALB' || id === 'TAL') tags.album ||= decodeText(enc, data.subarray(1)) || undefined
    else if (id === 'APIC' || id === 'PIC') {
      const wide = enc === 1 || enc === 2
      let at: number
      let mime: string
      if (id === 'PIC') {
        mime = PIC_MIME[ascii(data, 1, 3).toUpperCase()] ?? 'image/jpeg'
        at = 4
      } else {
        const end = nullEnd(data, 1, false)
        mime = latin1.decode(data.subarray(1, end)) || 'image/jpeg'
        if (!mime.includes('/')) mime = `image/${mime.toLowerCase() === 'jpg' ? 'jpeg' : mime.toLowerCase()}`
        at = end + 1
      }
      const type = data[at]!
      const descEnd = nullEnd(data, at + 1, wide)
      const picture = data.subarray(descEnd + (wide ? 2 : 1))
      // The front cover (type 3) wins over any other picture.
      if (picture.length && (coverType === -1 || (type === 3 && coverType !== 3))) {
        tags.cover = { mime, data: picture }
        coverType = type
      }
    }
  }
  tags.chapters?.sort((a, b) => a.startMs - b.startMs)
  return tags
}

/**
 * One ID3 CHAP frame: its element id (null-terminated), start and end times (ms), byte offsets, then sub-frames —
 * the title is the TIT2 among them. Null when it has no title.
 */
function parseChap(data: Uint8Array, version: number): { startMs: number; title: string } | null {
  let at = nullEnd(data, 0, false) + 1
  if (at + 16 > data.length) return null
  const startMs = uint32(data, at)
  at += 16
  while (at + 10 <= data.length) {
    const id = ascii(data, at, 4)
    if (!/^[A-Z0-9]+$/.test(id)) break
    const size = version === 4 ? syncsafe(data, at + 4) : uint32(data, at + 4)
    const sub = data.subarray(at + 10, at + 10 + size)
    at += 10 + size
    if (id === 'TIT2' && sub.length) {
      const title = decodeText(sub[0]!, sub.subarray(1))
      return title ? { startMs, title } : null
    }
  }
  return null
}

/** The first child box of `type` within buf[start..end), as [contentStart, end]; null when there is none. */
export function findMp4Box(buf: Uint8Array, start: number, end: number, type: string): [number, number] | null {
  let pos = start
  while (pos + 8 <= end) {
    let size = uint32(buf, pos)
    const kind = latin1.decode(buf.subarray(pos + 4, pos + 8))
    let header = 8
    if (size === 1) {
      if (pos + 16 > end) return null
      size = uint32(buf, pos + 8) * 2 ** 32 + uint32(buf, pos + 12)
      header = 16
    } else if (size === 0) size = end - pos
    if (size < header) return null
    if (kind === type) return [pos + header, Math.min(end, pos + size)]
    pos += size
  }
  return null
}

/** Reads the iTunes-style tags of an MP4/M4A: `buf` is the file's 'moov' box (or the whole file). */
export function parseMp4(buf: Uint8Array): AudioTags {
  const moov: [number, number] | null = latin1.decode(buf.subarray(4, 8)) === 'moov' ? [8, buf.length] : findMp4Box(buf, 0, buf.length, 'moov')
  if (!moov) return {}
  const udta = findMp4Box(buf, moov[0], moov[1], 'udta')
  const meta = (udta && findMp4Box(buf, udta[0], udta[1], 'meta')) ?? findMp4Box(buf, moov[0], moov[1], 'meta')
  if (!meta) return {}
  // 'meta' is a full box: 4 bytes of version and flags come before its children.
  const ilst = findMp4Box(buf, meta[0] + 4, meta[1], 'ilst')
  if (!ilst) return {}
  const item = (type: string) => {
    const box = findMp4Box(buf, ilst[0], ilst[1], type)
    const data = box && findMp4Box(buf, box[0], box[1], 'data')
    return data ? { kind: uint32(buf, data[0]) & 0xffffff, bytes: buf.subarray(data[0] + 8, data[1]) } : null
  }
  const text = (type: string) => {
    const d = item(type)
    return d ? utf8.decode(d.bytes).trim() || undefined : undefined
  }
  const tags: AudioTags = { title: text('©nam'), artist: text('©ART'), album: text('©alb') }
  const covr = item('covr')
  if (covr?.bytes.length) tags.cover = { mime: covr.kind === 14 ? 'image/png' : 'image/jpeg', data: covr.bytes }
  return Object.fromEntries(Object.entries(tags).filter(([, v]) => v !== undefined)) as AudioTags
}

// ── FLAC, Ogg Vorbis and Opus: "Vorbis comments" (KEY=value) and FLAC picture blocks ──

function le32(b: Uint8Array, at: number): number {
  return ((b[at + 3]! << 24) >>> 0) + (b[at + 2]! << 16) + (b[at + 1]! << 8) + b[at]!
}

/** A FLAC picture block (also carried base64-encoded in Ogg as METADATA_BLOCK_PICTURE); null when it doesn't add up. */
export function parseFlacPicture(b: Uint8Array): { type: number; mime: string; data: Uint8Array } | null {
  if (b.length < 32) return null
  const type = uint32(b, 0)
  const mimeLen = uint32(b, 4)
  let at = 8 + mimeLen
  if (at + 4 > b.length) return null
  const mime = latin1.decode(b.subarray(8, at)) || 'image/jpeg'
  at += 4 + uint32(b, at) + 16 // the description, then width, height, depth and colours
  if (at + 4 > b.length) return null
  const length = uint32(b, at)
  const data = b.subarray(at + 4, at + 4 + length)
  return data.length === length && length > 0 ? { type, mime, data } : null
}

function base64Bytes(s: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

/** Keeps a picture when there is none yet, or when it is the front cover (type 3) and the one kept isn't. */
function offerCover(tags: AudioTags, kept: { type: number }, pic: { type: number; mime: string; data: Uint8Array } | null) {
  if (!pic || (tags.cover && !(pic.type === 3 && kept.type !== 3))) return
  tags.cover = { mime: pic.mime, data: pic.data }
  kept.type = pic.type
}

/**
 * A Vorbis comment block (little-endian lengths: vendor, count, then "KEY=value" entries), as FLAC, Ogg Vorbis
 * and Opus store their tags. Reads what fits when the block is cut short.
 */
export function parseVorbisComment(b: Uint8Array, tags: AudioTags = {}, kept = { type: -1 }): AudioTags {
  if (b.length < 8) return tags
  let at = 4 + le32(b, 0)
  if (at + 4 > b.length) return tags
  const count = le32(b, at)
  at += 4
  for (let i = 0; i < count && at + 4 <= b.length; i++) {
    const len = le32(b, at)
    const entry = b.subarray(at + 4, at + 4 + len)
    at += 4 + len
    if (entry.length < len) break
    const eq = entry.indexOf(0x3d) // '='
    if (eq <= 0) continue
    const key = latin1.decode(entry.subarray(0, eq)).toUpperCase()
    if (key === 'METADATA_BLOCK_PICTURE') {
      const raw = base64Bytes(latin1.decode(entry.subarray(eq + 1)))
      offerCover(tags, kept, raw && parseFlacPicture(raw))
      continue
    }
    const value = utf8.decode(entry.subarray(eq + 1)).trim()
    if (!value) continue
    if (key === 'TITLE') tags.title ||= value
    else if (key === 'ARTIST') tags.artist ||= value
    else if (key === 'ALBUM') tags.album ||= value
  }
  return tags
}

/** Reads a FLAC file's tags and pictures: `buf` holds at least its metadata blocks. */
export function parseFlac(buf: Uint8Array): AudioTags {
  if (buf.length < 4 || ascii(buf, 0, 4) !== 'fLaC') return {}
  const tags: AudioTags = {}
  const kept = { type: -1 }
  let pos = 4
  while (pos + 4 <= buf.length) {
    const type = buf[pos]! & 0x7f
    const last = buf[pos]! & 0x80
    const len = (buf[pos + 1]! << 16) | (buf[pos + 2]! << 8) | buf[pos + 3]!
    const data = buf.subarray(pos + 4, pos + 4 + len)
    if (type === 4) parseVorbisComment(data, tags, kept)
    else if (type === 6) offerCover(tags, kept, parseFlacPicture(data))
    if (last) break
    pos += 4 + len
  }
  return tags
}

/**
 * Reads the tags of an Ogg Vorbis or Opus file: `buf` is the start of the file. The pages' payloads are joined into
 * one stream, where the comment packet ("OpusTags", or 3 + "vorbis") follows the identification packet.
 */
export function parseOgg(buf: Uint8Array): AudioTags {
  const parts: Uint8Array[] = []
  let pos = 0
  while (pos + 27 <= buf.length && ascii(buf, pos, 4) === 'OggS') {
    const segments = buf[pos + 26]!
    let size = 0
    for (let i = 0; i < segments; i++) size += buf[pos + 27 + i] ?? 0
    const start = pos + 27 + segments
    parts.push(buf.subarray(start, Math.min(buf.length, start + size)))
    pos = start + size
  }
  const stream = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    stream.set(p, at)
    at += p.length
  }
  const text = latin1.decode(stream.subarray(0, Math.min(stream.length, 4096)))
  const opus = text.indexOf('OpusTags')
  if (opus !== -1) return parseVorbisComment(stream.subarray(opus + 8))
  const vorbis = text.indexOf('\u0003vorbis', 1) // the identification packet starts with 1 + "vorbis"
  if (vorbis !== -1) return parseVorbisComment(stream.subarray(vorbis + 7))
  return {}
}
