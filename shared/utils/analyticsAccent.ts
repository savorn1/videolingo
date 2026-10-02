// One colour per Analytics area (the selected tab is a filled pill in it, with white text — the 700 shade keeps white above 4.5:1), so the tab, its icon, its charts' accent and its tiles all read as that
// area. `scope` is a .tab-scope-<colour> rule in main.css (it recolours Nuxt UI's "primary" inside the area),
// `ui` colours the tab itself, `indicator` the underline of the selected tab. Full class names so Tailwind sees them.

export type AnalyticsAreaKey = 'users' | 'videos' | 'watch' | 'translations' | 'languages' | 'storage' | 'ai'

export interface AreaAccent {
  scope: string
  indicator: string
  ui: { trigger: string; leadingIcon: string }
}

export const ANALYTICS_ACCENTS: Record<AnalyticsAreaKey, AreaAccent> = {
  users: {
    scope: 'tab-scope-sky',
    indicator: 'bg-sky-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  videos: {
    scope: 'tab-scope-violet',
    indicator: 'bg-violet-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  watch: {
    scope: 'tab-scope-emerald',
    indicator: 'bg-emerald-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  translations: {
    scope: 'tab-scope-teal',
    indicator: 'bg-teal-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  languages: {
    scope: 'tab-scope-orange',
    indicator: 'bg-orange-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  storage: {
    scope: 'tab-scope-amber',
    indicator: 'bg-amber-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  },
  ai: {
    scope: 'tab-scope-rose',
    indicator: 'bg-rose-700 shadow-sm',
    ui: { trigger: 'data-[state=active]:text-white', leadingIcon: 'group-data-[state=active]:text-white' }
  }
}
