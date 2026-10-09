import { id3TagLength, parseFlac, parseId3, parseMp4, parseOgg, type AudioTags } from '#shared/utils/audioTags'

/** The most of a file read for its tags, so a huge recording is never loaded whole. */
const MAX_TAG_BYTES = 20 * 1024 * 1024
/** How much of an Ogg file is read: its tags come in the first pages (a cover larger than this is missed). */
const OGG_TAG_BYTES = 8 * 1024 * 1024

async function bytes(file: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(start, end).arrayBuffer())
}

/**
 * The title, artist and cover art written inside an audio file, read in the browser: the ID3 tag at the start of
 * an MP3 (or of any file that starts with one), the 'moov' box of an M4A/MP4 found by walking its top-level
 * boxes, a FLAC file's metadata blocks, or the first pages of an Ogg Vorbis/Opus file. Empty when there are none
 * or they can't be read.
 */
export async function readAudioTags(file: File): Promise<AudioTags> {
  try {
    const head = await bytes(file, 0, 16)
    const id3 = id3TagLength(head)
    if (id3 !== null) return id3 <= MAX_TAG_BYTES ? parseId3(await bytes(file, 0, id3)) : {}
    const magic = new TextDecoder('latin1').decode(head.subarray(0, 4))
    if (magic === 'OggS') return parseOgg(await bytes(file, 0, Math.min(file.size, OGG_TAG_BYTES)))
    if (magic === 'fLaC') {
      // Walk the metadata block headers (4 bytes each) to where the blocks end, then read them in one go.
      let end = 4
      for (;;) {
        const h = await bytes(file, end, end + 4)
        if (h.length < 4) break
        end += 4 + ((h[1]! << 16) | (h[2]! << 8) | h[3]!)
        if (h[0]! & 0x80 || end > MAX_TAG_BYTES) break
      }
      return end <= MAX_TAG_BYTES ? parseFlac(await bytes(file, 0, end)) : {}
    }
    if (new TextDecoder('latin1').decode(head.subarray(4, 8)) !== 'ftyp') return {}
    // Walk the top-level boxes (8-byte headers) to the 'moov' box, wherever it is in the file.
    let pos = 0
    while (pos + 8 <= file.size) {
      const h = await bytes(file, pos, pos + 16)
      let size = ((h[0]! << 24) >>> 0) + (h[1]! << 16) + (h[2]! << 8) + h[3]!
      if (size === 1)
        size = (((h[8]! << 24) >>> 0) + (h[9]! << 16) + (h[10]! << 8) + h[11]!) * 2 ** 32 + ((h[12]! << 24) >>> 0) + (h[13]! << 16) + (h[14]! << 8) + h[15]!
      else if (size === 0) size = file.size - pos
      if (new TextDecoder('latin1').decode(h.subarray(4, 8)) === 'moov') {
        return size <= MAX_TAG_BYTES ? parseMp4(await bytes(file, pos, pos + size)) : {}
      }
      if (size < 8) return {}
      pos += size
    }
    return {}
  } catch {
    return {}
  }
}
