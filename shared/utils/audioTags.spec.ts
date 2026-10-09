import { describe, expect, it } from 'vitest'
import { findMp4Box, id3TagLength, parseFlac, parseFlacPicture, parseId3, parseMp4, parseOgg, parseVorbisComment } from './audioTags'

const enc = new TextEncoder()
const bytes = (...parts: (number[] | Uint8Array | string)[]) => Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...enc.encode(p)] : [...p])))
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const syncsafe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127]

/** An ID3 frame: v2.3 sizes are plain big-endian numbers, v2.4 sizes are "syncsafe". */
function frame(id: string, data: Uint8Array, version: 3 | 4) {
  return bytes(id, version === 4 ? syncsafe(data.length) : be32(data.length), [0, 0], data)
}
function tag(version: 3 | 4, frames: Uint8Array[]) {
  const body = bytes(...frames)
  return bytes('ID3', [version, 0, 0], syncsafe(body.length), body)
}
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

describe('ID3v2', () => {
  it('finds the tag length and reads title, artist and the front cover (v2.3)', () => {
    const t = tag(3, [
      frame('TIT2', bytes([3], 'Lesson 4 — Greetings'), 3),
      frame('TPE1', bytes([0], 'Dara'), 3),
      frame('APIC', bytes([0], 'image/png', [0], [0], 'back', [0], [9, 9]), 3),
      frame('APIC', bytes([0], 'image/jpeg', [0], [3], '', [0], jpeg), 3)
    ])
    expect(id3TagLength(t)).toBe(t.length)
    expect(id3TagLength(bytes('RIFF....'))).toBeNull()
    const tags = parseId3(t)
    expect(tags.title).toBe('Lesson 4 — Greetings')
    expect(tags.artist).toBe('Dara')
    expect(tags.cover?.mime).toBe('image/jpeg')
    expect([...tags.cover!.data]).toEqual([...jpeg])
  })
  it('reads UTF-16 text with a byte order mark and syncsafe sizes (v2.4)', () => {
    const utf16 = (s: string) => Uint8Array.from([0xff, 0xfe, ...[...s].flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])])
    const t = tag(4, [frame('TIT2', bytes([1], utf16('សួស្តី')), 4)])
    expect(parseId3(t).title).toBe('សួស្តី')
  })
  it('stops quietly at padding and gives nothing for a file without a tag', () => {
    const t = tag(3, [frame('TIT2', bytes([0], 'A'), 3), Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])])
    expect(parseId3(t)).toEqual({ title: 'A' })
    expect(parseId3(bytes('not an mp3 tag'))).toEqual({})
  })
})

/** An MP4 box: 4-byte size, 4-char type, content. */
const box = (type: string, ...content: Uint8Array[]) => {
  const body = bytes(...content)
  // Box names are single bytes (Latin-1): '©' is 0xA9, not UTF-8's two bytes.
  return bytes(
    be32(8 + body.length),
    [...type].map((c) => c.charCodeAt(0)),
    body
  )
}
const dataBox = (kind: number, payload: Uint8Array) => box('data', Uint8Array.from([...be32(kind), 0, 0, 0, 0]), payload)

describe('MP4 / M4A', () => {
  const ilst = box(
    'ilst',
    box('©nam', dataBox(1, enc.encode('Episode 12'))),
    box('©ART', dataBox(1, enc.encode('The Khmer Podcast'))),
    box('covr', dataBox(14, Uint8Array.from([0x89, 0x50, 0x4e, 0x47])))
  )
  const meta = box('meta', Uint8Array.from([0, 0, 0, 0]), box('hdlr', Uint8Array.from([0, 0, 0, 0])), ilst)
  const moov = box('moov', box('mvhd', Uint8Array.from([0, 0])), box('udta', meta))
  const file = bytes(box('ftyp', enc.encode('M4A ')), box('mdat', Uint8Array.from([1, 2, 3])), moov)

  it('finds boxes in order', () => {
    expect(findMp4Box(file, 0, file.length, 'moov')).not.toBeNull()
    expect(findMp4Box(file, 0, file.length, 'trak')).toBeNull()
  })
  it('reads the title, artist and a PNG cover from the whole file or just its moov box', () => {
    for (const source of [file, moov]) {
      const tags = parseMp4(source)
      expect(tags.title).toBe('Episode 12')
      expect(tags.artist).toBe('The Khmer Podcast')
      expect(tags.cover?.mime).toBe('image/png')
      expect(tags.album).toBeUndefined()
    }
  })
  it('gives nothing when there are no tags', () => {
    expect(parseMp4(box('moov', box('mvhd', Uint8Array.from([0]))))).toEqual({})
    expect(parseMp4(bytes('garbage!'))).toEqual({})
  })
})

// ── FLAC, Ogg Vorbis and Opus ──
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]
function vorbisComment(entries: string[]) {
  const vendor = enc.encode('test')
  return bytes(le32(vendor.length), vendor, le32(entries.length), ...entries.flatMap((e) => [le32(enc.encode(e).length), e]))
}
function flacPicture(type: number, mime: string, data: Uint8Array) {
  return bytes(be32(type), be32(mime.length), mime, be32(0), be32(0), be32(0), be32(0), be32(0), be32(data.length), data)
}
function flacBlock(type: number, data: Uint8Array, last = false) {
  return bytes([type | (last ? 0x80 : 0)], [(data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data)
}
/** One Ogg page holding `payload` (a single segment table entry per 255 bytes). */
function oggPage(payload: Uint8Array) {
  const lacing: number[] = []
  let n = payload.length
  while (n >= 255) {
    lacing.push(255)
    n -= 255
  }
  lacing.push(n)
  return bytes('OggS', new Array(22).fill(0), [lacing.length], lacing, payload)
}
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2])

describe('Vorbis comments', () => {
  it('reads title, artist and album, whatever the key case, keeping the first of each', () => {
    const tags = parseVorbisComment(vorbisComment(['title=Lesson 5', 'ARTIST=Dara', 'Album=Khmer A1', 'TITLE=ignored', 'NOEQUALS']))
    expect(tags).toEqual({ title: 'Lesson 5', artist: 'Dara', album: 'Khmer A1' })
  })
  it('reads a cover carried as METADATA_BLOCK_PICTURE', () => {
    const b64 = btoa(String.fromCharCode(...flacPicture(3, 'image/png', png)))
    const tags = parseVorbisComment(vorbisComment(['TITLE=x', `METADATA_BLOCK_PICTURE=${b64}`]))
    expect(tags.cover?.mime).toBe('image/png')
    expect([...tags.cover!.data]).toEqual([...png])
  })
  it('keeps what fits when the block is cut short', () => {
    const full = vorbisComment(['TITLE=Kept', 'ARTIST=Lost'])
    expect(parseVorbisComment(full.subarray(0, full.length - 3))).toEqual({ title: 'Kept' })
  })
})

describe('FLAC', () => {
  it('reads the comment block and prefers the front cover', () => {
    const file = bytes(
      'fLaC',
      flacBlock(0, new Uint8Array(34)),
      flacBlock(6, flacPicture(4, 'image/jpeg', jpeg)),
      flacBlock(4, vorbisComment(['TITLE=សួស្តី'])),
      flacBlock(6, flacPicture(3, 'image/png', png), true),
      [0xff, 0xf8] // audio frames follow
    )
    const tags = parseFlac(file)
    expect(tags.title).toBe('សួស្តី')
    expect(tags.cover?.mime).toBe('image/png')
  })
  it('gives nothing for another file, and skips a broken picture', () => {
    expect(parseFlac(bytes('RIFF....'))).toEqual({})
    expect(parseFlacPicture(bytes(be32(3), be32(500), 'image/png'))).toBeNull()
  })
})

describe('Ogg', () => {
  it('reads Opus tags from the second packet', () => {
    const file = bytes(oggPage(bytes('OpusHead', new Array(11).fill(0))), oggPage(bytes('OpusTags', vorbisComment(['TITLE=Podcast 12', 'ARTIST=Sok']))))
    expect(parseOgg(file)).toEqual({ title: 'Podcast 12', artist: 'Sok' })
  })
  it('reads Vorbis tags, even when the comment packet spans pages', () => {
    const comment = bytes([3], 'vorbis', vorbisComment(['TITLE=' + 'A'.repeat(300)]))
    const file = bytes(oggPage(bytes([1], 'vorbis', new Array(23).fill(0))), oggPage(comment.subarray(0, 200)), oggPage(comment.subarray(200)))
    expect(parseOgg(file).title).toBe('A'.repeat(300))
  })
  it('gives nothing without the Ogg pages or tags', () => {
    expect(parseOgg(bytes('ID3'))).toEqual({})
    expect(parseOgg(oggPage(bytes('OpusHead')))).toEqual({})
  })
})
