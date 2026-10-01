// The editor's text & image layers in progress — shared by the "Text &
// overlay" tab (settings) and OverlayLayers (the draggable preview over the
// video). Becomes the request POSTed to /edits/overlay; the backend checks it
// again (OverlayRules) and draws text with the server's fonts.

import type { OverlayLayer } from '~/composables/useVideoEdits'
import { moveItem } from '#shared/utils/reorder'

export interface EditorLayer extends OverlayLayer {
  id: string
  /** Where the uploaded image can be shown in the preview. */
  imageUrl: string | null
  imageName: string | null
}

export const LAYER_WEIGHTS = [
  { label: 'Light', value: 300 },
  { label: 'Regular', value: 400 },
  { label: 'Medium', value: 500 },
  { label: 'Semibold', value: 600 },
  { label: 'Bold', value: 700 },
  { label: 'Black', value: 900 }
]

export const LAYER_ANIMATIONS: { label: string; value: OverlayLayer['animation'] }[] = [
  { label: 'None', value: 'NONE' },
  { label: 'Fade in & out', value: 'FADE' },
  { label: 'Slide up', value: 'SLIDE_UP' },
  { label: 'Slide in from left', value: 'SLIDE_LEFT' }
]

/** A 3×3 grid of spots, as layer centres (a little in from the edges). */
export const LAYER_SPOTS = [0.1, 0.5, 0.9].flatMap((y) => [0.12, 0.5, 0.88].map((x) => ({ x, y })))

/** CSS for one of the server's font families (Java's logical fonts map onto generic families). */
export function fontCss(font: string | null) {
  if (!font || font === 'SansSerif') return 'sans-serif'
  if (font === 'Serif') return 'serif'
  if (font === 'Monospaced') return 'monospace'
  return `"${font.replace(/"/g, '')}", sans-serif`
}

/** Entrance/exit length, as the backend works it out (OverlayRules.build). */
export function animationSeconds(startMs: number, endMs: number) {
  return Math.min(0.5, (endMs - startMs) / 1000 / 3)
}

let seq = 0
function newId() {
  seq += 1
  return `layer${Date.now().toString(36)}${seq}`
}

function base(): Omit<EditorLayer, 'kind' | 'text'> {
  return {
    id: newId(),
    font: 'SansSerif',
    weight: 700,
    sizePct: 6,
    color: '#ffffff',
    background: '#000000',
    backgroundOpacity: 0.55,
    align: 'CENTER',
    imageKey: null,
    imageUrl: null,
    imageName: null,
    widthPct: 20,
    x: 0.5,
    y: 0.85,
    opacity: 1,
    startMs: 0,
    endMs: null,
    animation: 'FADE'
  }
}

export function useOverlayEdit(durationMs: Ref<number>) {
  const state = reactive({
    layers: [] as EditorLayer[],
    selectedId: null as string | null,
    /** Layers picked along with `selectedId` (shift/ctrl-click); they move, copy and go together. */
    multi: [] as string[]
  })

  const selected = computed(() => state.layers.find((l) => l.id === state.selectedId) ?? null)

  /** The selected layer and every other picked one. */
  const group = computed(() => state.layers.filter((l) => l.id === state.selectedId || state.multi.includes(l.id)))
  const isPicked = (id: string) => id === state.selectedId || state.multi.includes(id)

  /** Shift/ctrl-click: adds a layer to the group, or drops it from it. */
  function toggleMulti(id: string) {
    if (!state.selectedId) {
      state.selectedId = id
      return
    }
    if (id === state.selectedId) {
      // Give the primary role to another picked layer, if there is one.
      state.selectedId = state.multi.shift() ?? null
      return
    }
    state.multi = state.multi.includes(id) ? state.multi.filter((x) => x !== id) : [...state.multi, id]
  }

  /** A plain click: just this layer. */
  function select(id: string | null) {
    state.selectedId = id
    state.multi = []
  }

  function removeGroup() {
    const ids = new Set(group.value.map((l) => l.id))
    state.layers = state.layers.filter((l) => !ids.has(l.id))
    state.selectedId = null
    state.multi = []
  }

  function duplicateGroup() {
    const copies = group.value.map((l) => ({ ...l, id: newId(), x: Math.min(1, l.x + 0.03), y: Math.min(1, l.y + 0.03) }))
    state.layers.push(...copies)
    state.selectedId = copies[0]?.id ?? null
    state.multi = copies.slice(1).map((l) => l.id)
  }

  /** Lines the group up on the first one's left, centre or right, or top, middle or bottom. */
  function alignGroup(edge: 'x' | 'y') {
    const first = state.layers.find((l) => l.id === state.selectedId)
    if (!first) return
    for (const l of group.value) l[edge] = first[edge]
  }

  /** Gives every other text layer in the group the look of the selected one. */
  function matchStyleInGroup() {
    const from = state.layers.find((l) => l.id === state.selectedId)
    if (!from) return 0
    const { font, weight, sizePct, color, background, backgroundOpacity, align } = from
    let n = 0
    for (const l of group.value) {
      if (l.kind !== 'TEXT' || l.id === from.id) continue
      Object.assign(l, { font, weight, sizePct, color, background, backgroundOpacity, align })
      n++
    }
    return n
  }

  function add(layer: EditorLayer) {
    state.layers.push(layer)
    state.multi = []
    state.selectedId = layer.id
    return layer
  }

  /** A caption-style text layer at the playhead, 3 s long. */
  function addText(atMs: number) {
    const start = Math.max(0, Math.min(Math.round(atMs), Math.max(0, durationMs.value - 500)))
    return add({ ...base(), kind: 'TEXT', text: 'Your text', startMs: start, endMs: Math.min(durationMs.value || start + 3000, start + 3000) })
  }

  function addImage(image: { key: string; url: string; name: string }, watermark = false) {
    return add({
      ...base(),
      kind: 'IMAGE',
      text: null,
      imageKey: image.key,
      imageUrl: image.url,
      imageName: image.name,
      widthPct: watermark ? 12 : 25,
      x: watermark ? 0.9 : 0.5,
      y: watermark ? 0.1 : 0.5,
      opacity: watermark ? 0.6 : 1,
      animation: watermark ? 'NONE' : 'FADE'
    })
  }

  /** Small, see-through, bottom right, for the whole video. */
  function addTextWatermark() {
    return add({
      ...base(),
      kind: 'TEXT',
      text: '© Your name',
      weight: 600,
      sizePct: 3.5,
      background: null,
      x: 0.88,
      y: 0.92,
      align: 'RIGHT',
      opacity: 0.6,
      animation: 'NONE'
    })
  }

  /** One-click looks for the common cases; all start at the playhead and last 3 s (a title 4 s). */
  function addPreset(kind: 'TITLE' | 'LOWER_THIRD' | 'CAPTION', atMs: number) {
    const l = addText(atMs)
    if (kind === 'TITLE') {
      Object.assign(l, { text: 'Your title', sizePct: 11, weight: 900, x: 0.5, y: 0.45, background: null, animation: 'FADE' })
      l.endMs = Math.min(durationMs.value || l.startMs + 4000, l.startMs + 4000)
    } else if (kind === 'LOWER_THIRD') {
      Object.assign(l, { text: 'Name\nRole', sizePct: 5, weight: 600, x: 0.2, y: 0.82, align: 'LEFT', backgroundOpacity: 0.7, animation: 'SLIDE_LEFT' })
    } else {
      Object.assign(l, { text: 'Caption', sizePct: 5, weight: 600, x: 0.5, y: 0.9, animation: 'NONE' })
    }
    return l
  }

  /** One text layer per subtitle cue (a cue's line breaks are kept); returns how many were added. */
  function addFromCues(cues: { startMs: number; endMs: number; text: string }[]) {
    const usable = cues.filter((c) => c.text.trim() && c.endMs > c.startMs)
    for (const c of usable) {
      state.layers.push({ ...base(), kind: 'TEXT', text: c.text.trim(), startMs: c.startMs, endMs: c.endMs, y: 0.9, sizePct: 5, weight: 600, animation: 'NONE' })
    }
    if (usable.length) state.selectedId = state.layers[state.layers.length - 1]!.id
    return usable.length
  }

  /** Gives every text layer the look of `id` (font, size, colours, box, alignment). */
  function applyStyleToAll(id: string) {
    const from = state.layers.find((l) => l.id === id)
    if (!from) return 0
    const { font, weight, sizePct, color, background, backgroundOpacity, align } = from
    let n = 0
    for (const l of state.layers) {
      if (l.kind !== 'TEXT' || l.id === id) continue
      Object.assign(l, { font, weight, sizePct, color, background, backgroundOpacity, align })
      n++
    }
    return n
  }

  /** Pulls a layer's centre in from the frame's edges (a rough title-safe area). */
  function keepInSafeArea(id: string) {
    const l = state.layers.find((x) => x.id === id)
    if (!l) return
    l.x = Math.min(0.9, Math.max(0.1, l.x))
    l.y = Math.min(0.92, Math.max(0.08, l.y))
  }

  /** Appends a saved template's layers (new ids, timing clamped to this video's length). */
  function addTemplate(layers: EditorLayer[]) {
    const max = Math.max(0, durationMs.value - 500)
    const copies = layers.map((l) => ({
      ...l,
      id: newId(),
      startMs: Math.min(Math.max(0, l.startMs), max),
      endMs: l.endMs == null ? null : Math.min(Math.max(l.startMs + 100, l.endMs), durationMs.value || l.endMs)
    }))
    state.layers.push(...copies)
    state.selectedId = copies[copies.length - 1]?.id ?? state.selectedId
  }

  function remove(id: string) {
    state.layers = state.layers.filter((l) => l.id !== id)
    state.multi = state.multi.filter((x) => x !== id)
    if (state.selectedId === id) state.selectedId = state.multi.shift() ?? null
  }

  function duplicate(id: string) {
    const l = state.layers.find((x) => x.id === id)
    if (!l) return
    const copy = { ...l, id: newId(), x: Math.min(1, l.x + 0.03), y: Math.min(1, l.y + 0.03) }
    state.layers.splice(state.layers.indexOf(l) + 1, 0, copy)
    state.selectedId = copy.id
  }

  /** Later layers are drawn on top; `dir` 1 brings one forward. */
  function reorder(id: string, dir: 1 | -1) {
    const i = state.layers.findIndex((l) => l.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= state.layers.length) return
    const list = [...state.layers]
    ;[list[i], list[j]] = [list[j]!, list[i]!]
    state.layers = list
  }

  /** Puts a layer at `index` in the stack (drag and drop); later layers are on top. */
  function moveTo(id: string, index: number) {
    const from = state.layers.findIndex((l) => l.id === id)
    if (from < 0) return
    state.layers = moveItem(state.layers, from, index)
  }

  function reset() {
    state.layers = []
    state.selectedId = null
    state.multi = []
  }

  const request = computed<OverlayLayer[]>(() => state.layers.map(({ id: _id, imageUrl: _url, imageName: _name, ...layer }) => layer))

  const error = computed(() => {
    if (!state.layers.length) return 'Add a text or image layer first'
    for (const [i, l] of state.layers.entries()) {
      const at = `Layer ${i + 1}: `
      if (l.kind === 'TEXT' && !l.text?.trim()) return `${at}the text is empty`
      if (l.kind === 'IMAGE' && !l.imageKey) return `${at}upload the image`
      if (l.endMs != null && l.endMs <= l.startMs) return `${at}it must end after it starts`
      if (durationMs.value && l.startMs >= durationMs.value) return `${at}it starts after the end of the video`
    }
    return null
  })

  return { state, selected, group, isPicked, toggleMulti, select, removeGroup, duplicateGroup, alignGroup, matchStyleInGroup, addText, addImage, addTextWatermark, addPreset, addFromCues, applyStyleToAll, keepInSafeArea, addTemplate, remove, duplicate, reorder, moveTo, reset, request, error }
}

export type OverlayEdit = ReturnType<typeof useOverlayEdit>
