import { describe, expect, it } from 'vitest'
import { findMp4Box, id3TagLength, parseId3, parseMp4 } from './audioTags'

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
