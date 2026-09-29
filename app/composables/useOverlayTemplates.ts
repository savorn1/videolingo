// Saved text & overlay layouts, kept in this browser (not per-video, so a
// title card or logo placement built on one video can be reused on any
// other). Image layers keep their uploaded key, which stays valid — S3
// objects aren't scoped to a video.

import { addEntry, removeEntry, renameEntry, type NamedEntry } from '#shared/utils/namedList'
import type { EditorLayer } from '~/composables/useOverlayEdit'

const STORAGE_KEY = 'videolingo:overlay-templates'
export type OverlayTemplate = NamedEntry<EditorLayer[]> & { builtin?: boolean }

// A starter layout: the parts of EditorLayer that matter for a template. The
// rest (id, imageUrl, imageName, etc.) get filled in with base()'s defaults
// by useOverlayEdit.addTemplate, same as any saved template.
type StarterLayer = Pick<
  EditorLayer,
  | 'kind'
  | 'text'
  | 'font'
  | 'weight'
  | 'sizePct'
  | 'color'
  | 'background'
  | 'backgroundOpacity'
  | 'align'
  | 'x'
  | 'y'
  | 'opacity'
  | 'startMs'
  | 'endMs'
  | 'animation'
>
function starter(layer: StarterLayer): EditorLayer {
  return { id: '', imageKey: null, imageUrl: null, imageName: null, widthPct: 20, ...layer }
}

// Text-only (a fresh install has no uploaded images to build an IMAGE layer
// from) — a useful starting point for the three shapes people build most.
export const BUILTIN_TEMPLATES: OverlayTemplate[] = [
  {
    id: 'builtin-lower-third',
    name: 'Lower-third title',
    savedAt: 0,
    builtin: true,
    data: [
      starter({
        kind: 'TEXT',
        text: 'Your Name\nTitle / Role',
        font: 'SansSerif',
        weight: 700,
        sizePct: 5,
        color: '#ffffff',
        background: '#000000',
        backgroundOpacity: 0.6,
        align: 'LEFT',
        x: 0.24,
        y: 0.85,
        opacity: 1,
        startMs: 0,
        endMs: 5000,
        animation: 'SLIDE_LEFT'
      })
    ]
  },
  {
    id: 'builtin-cta-banner',
    name: 'Call-to-action banner',
    savedAt: 0,
    builtin: true,
    data: [
      starter({
        kind: 'TEXT',
        text: 'Subscribe for more!',
        font: 'SansSerif',
        weight: 700,
        sizePct: 5.5,
        color: '#ffffff',
        background: '#dc2626',
        backgroundOpacity: 0.85,
        align: 'CENTER',
        x: 0.5,
        y: 0.88,
        opacity: 1,
        startMs: 0,
        endMs: 4000,
        animation: 'SLIDE_UP'
      })
    ]
  },
  {
    id: 'builtin-intro-title',
    name: 'Intro title card',
    savedAt: 0,
    builtin: true,
    data: [
      starter({
        kind: 'TEXT',
        text: 'Welcome!',
        font: 'Serif',
        weight: 700,
        sizePct: 10,
        color: '#ffffff',
        background: null,
        backgroundOpacity: 0,
        align: 'CENTER',
        x: 0.5,
        y: 0.5,
        opacity: 1,
        startMs: 0,
        endMs: 3000,
        animation: 'FADE'
      })
    ]
  }
]

function read(): OverlayTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OverlayTemplate[]) : []
  } catch {
    return []
  }
}
function write(list: OverlayTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Private mode / storage full: templates just won't persist this session.
  }
}

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** A saved (or imported) entry's shape, loosely — just enough to trust it's a template. */
function isTemplateLike(v: unknown): v is { name: string; data: EditorLayer[] } {
  return !!v && typeof v === 'object' && typeof (v as any).name === 'string' && Array.isArray((v as any).data)
}

export function useOverlayTemplates() {
  const saved = ref<OverlayTemplate[]>([])
  onMounted(() => (saved.value = read()))

  // Built-ins first — always there, even before anyone has saved one of
  // their own — then whatever's been saved in this browser.
  const templates = computed(() => [...BUILTIN_TEMPLATES, ...saved.value])

  function save(name: string, layers: EditorLayer[]) {
    saved.value = addEntry(saved.value, name, layers)
    write(saved.value)
  }
  function remove(id: string) {
    saved.value = removeEntry(saved.value, id)
    write(saved.value)
  }
  function rename(id: string, name: string) {
    saved.value = renameEntry(saved.value, id, name)
    write(saved.value)
  }

  /** One template as a `.json` file, to hand to someone else or keep as a backup. */
  function exportOne(t: OverlayTemplate) {
    download(`${t.name.replace(/[^\w -]+/g, '').trim() || 'template'}.json`, { name: t.name, data: t.data })
  }
  /** Every template saved in this browser (not the built-ins — those are already everywhere). */
  function exportAll() {
    download(
      'overlay-templates.json',
      saved.value.map(({ name, data }) => ({ name, data }))
    )
  }

  /**
   * Loads templates from a file exported by either function above — one
   * template, or a whole list. Returns how many were added; throws with a
   * plain-English reason if the file doesn't look like a template export.
   */
  async function importFile(file: File): Promise<number> {
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      throw new Error("That file isn't valid JSON")
    }
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    const valid = entries.filter(isTemplateLike)
    if (!valid.length) {
      throw new Error("That doesn't look like a template file")
    }
    for (const t of valid) save(t.name, t.data)
    return valid.length
  }

  return { templates, save, remove, rename, exportOne, exportAll, importFile }
}
