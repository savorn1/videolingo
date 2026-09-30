// The current user's profile picture. The backend has no avatar endpoint yet,
// so the image is resized in the browser and kept in localStorage — it follows
// this browser only. Swap `save` / `clear` for API calls when one exists.

const MAX_INPUT_BYTES = 8 * 1024 * 1024
const OUTPUT_SIZE = 256

function storageKey(userId: number) {
  return `videolingo:avatar:${userId}`
}

function readStored(userId: number): string | null {
  try {
    return localStorage.getItem(storageKey(userId))
  } catch {
    return null
  }
}

/** Centre-crops to a square and downsizes, so the stored image stays small. */
async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image.')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function useAvatar() {
  const avatar = useState<string | null>('avatar', () => null)

  function load(userId: number) {
    avatar.value = readStored(userId)
  }

  async function save(userId: number, file: File) {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
    if (file.size > MAX_INPUT_BYTES) throw new Error('Image is too large (max 8 MB).')
    const dataUrl = await toSquareDataUrl(file)
    try {
      localStorage.setItem(storageKey(userId), dataUrl)
    } catch {
      throw new Error('Could not save the image in this browser.')
    }
    avatar.value = dataUrl
  }

  function clear(userId: number) {
    try {
      localStorage.removeItem(storageKey(userId))
    } catch {
      // storage unavailable — nothing to remove
    }
    avatar.value = null
  }

  return { avatar, load, save, clear }
}
