// The editor's tab colours, carried into each tab's panel: section headings,
// the main action button and the like. Full class strings (not built up) so
// Tailwind sees them. Light-mode shades are picked for contrast on white
// (text and icons at 700/600, white text on 700 fills — all above 4.5:1 for
// text, 3:1 for icons); dark mode uses the 400s with near-black text.

export type EditorTab = 'trim' | 'split' | 'audio' | 'overlay' | 'join'

export interface TabAccent {
  /** Section headings. */
  heading: string
  /** Solid main action button (use with color="neutral"). */
  button: string
  /** Fill + outline for a selected row — the outline means selection isn't shown by colour alone. */
  selected: string
  /** Small icons and links. */
  icon: string
  /** Divider between sections. */
  divider: string
  /** Quiet secondary buttons (use with color="neutral" variant="soft"). */
  soft: string
  /** Faint tint for a card header. */
  header: string
  /** Wrapper class that recolours Nuxt UI's primary (sliders, switches, focus rings) inside the tab; see main.css. */
  scope: string
}

const BUTTON_BASE = 'text-white disabled:bg-gray-200 disabled:text-gray-400 dark:text-gray-950 dark:disabled:bg-gray-800 dark:disabled:text-gray-500'

export const TAB_ACCENTS: Record<EditorTab, TabAccent> = {
  trim: {
    heading: 'text-sky-700 dark:text-sky-400',
    button: `${BUTTON_BASE} bg-sky-700 hover:bg-sky-800 dark:bg-sky-400 dark:hover:bg-sky-300`,
    selected: 'bg-sky-50 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/40 dark:ring-sky-800',
    icon: 'text-sky-600 dark:text-sky-400',
    divider: 'border-sky-100 dark:border-sky-950',
    soft: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60',
    header: 'bg-sky-50/70 dark:bg-sky-950/30',
    scope: 'tab-scope-sky'
  },
  split: {
    heading: 'text-violet-700 dark:text-violet-400',
    button: `${BUTTON_BASE} bg-violet-700 hover:bg-violet-800 dark:bg-violet-400 dark:hover:bg-violet-300`,
    selected: 'bg-violet-50 ring-1 ring-inset ring-violet-300 dark:bg-violet-950/40 dark:ring-violet-800',
    icon: 'text-violet-600 dark:text-violet-400',
    divider: 'border-violet-100 dark:border-violet-950',
    soft: 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/60',
    header: 'bg-violet-50/70 dark:bg-violet-950/30',
    scope: 'tab-scope-violet'
  },
  audio: {
    heading: 'text-emerald-700 dark:text-emerald-400',
    button: `${BUTTON_BASE} bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-400 dark:hover:bg-emerald-300`,
    selected: 'bg-emerald-50 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-950/40 dark:ring-emerald-800',
    icon: 'text-emerald-600 dark:text-emerald-400',
    divider: 'border-emerald-100 dark:border-emerald-950',
    soft: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60',
    header: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    scope: 'tab-scope-emerald'
  },
  overlay: {
    heading: 'text-rose-700 dark:text-rose-400',
    button: `${BUTTON_BASE} bg-rose-700 hover:bg-rose-800 dark:bg-rose-400 dark:hover:bg-rose-300`,
    selected: 'bg-rose-50 ring-1 ring-inset ring-rose-300 dark:bg-rose-950/40 dark:ring-rose-800',
    icon: 'text-rose-600 dark:text-rose-400',
    divider: 'border-rose-100 dark:border-rose-950',
    soft: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60',
    header: 'bg-rose-50/70 dark:bg-rose-950/30',
    scope: 'tab-scope-rose'
  },
  join: {
    heading: 'text-orange-700 dark:text-orange-400',
    button: `${BUTTON_BASE} bg-orange-700 hover:bg-orange-800 dark:bg-orange-400 dark:hover:bg-orange-300`,
    selected: 'bg-orange-50 ring-1 ring-inset ring-orange-300 dark:bg-orange-950/40 dark:ring-orange-800',
    icon: 'text-orange-600 dark:text-orange-400',
    divider: 'border-orange-100 dark:border-orange-950',
    soft: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-900/60',
    header: 'bg-orange-50/70 dark:bg-orange-950/30',
    scope: 'tab-scope-orange'
  }
}
