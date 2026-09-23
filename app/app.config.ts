// Presets for DataTable's table style (see useTableTheme). `ui` is a partial
// UTable `:ui` prop — Table.vue merges each slot's classes with its own
// computed defaults (`ui.th({ class: [props.ui?.th, ...] })`), so overrides
// here only ever add classes, never need `!important` or raw CSS selectors.
//
// `rowEvenClass` covers zebra striping, which UTable has no slot for since it
// styles every row uniformly — DataTable applies it per-row itself via the
// table's `meta.class.tr` hook (a function of the TanStack row).
//
// `sortButtonClass` isn't part of UTable's `ui` at all: DataTable renders its
// own sort toggle button (not UTable's built-in column-sort UI), so DataTable
// applies this directly as a class on that button.
export default defineAppConfig({
  ui: {
    colors: {
      // "Blueprint" brand palette — a muted drafting-table blue instead of
      // Tailwind's stock vibrant `blue`. Custom scale defined in main.css's
      // `@theme` block (not a built-in Tailwind color name).
      primary: 'blueprint',
      // `info` is used distinctly from `primary` (e.g. StatusBadge's
      // PROCESSING state, dashboard "info" stat tiles) — `azure` is the
      // Blueprint palette's lighter supporting blue, close enough in family
      // to read as "the same world" as primary while staying visibly lighter
      // so the two never collide on a badge or tile.
      info: 'azure',
      // Used by StatusBadge for entities like REFUNDED/REVERSED — "reversed"
      // reads as its own thing, not a shade of neutral gray shared with
      // CANCELLED. Not part of the Blueprint pitch (which only reworked
      // primary/info/cancelled) — left as the existing violet.
      secondary: 'violet',
      // Used by StatusBadge for CANCELLED — distinct from `warning`
      // (PENDING) despite being an adjacent hue. `copper` is the Blueprint
      // palette's warm accent (the pencil annotation to primary's ink).
      cancelled: 'copper',
      // `neutral` is what the vast majority of the app's buttons actually
      // render in (`color="neutral" variant="soft"` is the default for every
      // secondary action — Edit, Refresh, Filter, Manage, status changes,
      // etc., ~3x more common than every other button color combined) — left
      // at Nuxt UI's default `slate` it's pure achromatic gray with zero
      // brand identity. `ink` carries the same hue as `blueprint` at low
      // saturation, so it still reads as "just gray" at a glance but ties
      // the whole app together on close look.
      neutral: 'ink'
    },
    // The default panel-left-close/-open icons read as a generic window/code
    // glyph at the small size the collapsed sidebar's toggle renders at —
    // chevrons stay legible there and keep the same directional meaning
    // (left = collapsing that way, right = expanding that way).
    icons: {
      panelClose: 'i-lucide-chevrons-left',
      panelOpen: 'i-lucide-chevrons-right'
    }
  },
  tableThemes: {
    plain: {
      ui: {},
      rowEvenClass: '',
      sortButtonClass: ''
    },
    striped: {
      ui: {},
      rowEvenClass: 'bg-gray-50 dark:bg-gray-800/40',
      sortButtonClass: ''
    },
    bordered: {
      rowEvenClass: '',
      sortButtonClass: 'font-semibold',
      ui: {
        th: 'text-white bg-primary-500 dark:bg-primary-600 border border-primary-400 dark:border-primary-800',
        td: 'border border-gray-200 dark:border-gray-800'
      }
    }
  }
})
