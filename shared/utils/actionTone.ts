// A colour for what a row action does, so a menu of actions (Edit, View, Disable, Duplicate, Archive,
// Statistics, Delete…) can be told apart by its icons at a glance. `icon` colours the icon in the "…" menu;
// `button` is the soft look for an action shown as a button. Shades are 600/700 on pale fills (above 3:1
// for icons, 4.5:1 for the button text) with lighter ones for dark mode. Full class names so Tailwind sees them.

export type ActionTone = 'sky' | 'violet' | 'emerald' | 'amber' | 'orange' | 'teal' | 'indigo' | 'rose' | 'red'

export interface ActionToneClasses {
  icon: string
  button: string
}

export const ACTION_TONES: Record<ActionTone, ActionToneClasses> = {
  sky: {
    icon: 'text-sky-600 dark:text-sky-400',
    button: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/60'
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-400',
    button: 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/60'
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60'
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    button: 'bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-900/60'
  },
  teal: {
    icon: 'text-teal-600 dark:text-teal-400',
    button: 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/60'
  },
  indigo: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    button: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60'
  },
  rose: {
    icon: 'text-rose-600 dark:text-rose-400',
    button: 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/60'
  },
  red: {
    icon: 'text-red-600 dark:text-red-400',
    button: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60'
  }
}

export function actionIconClass(tone: ActionTone | undefined): string | undefined {
  return tone ? ACTION_TONES[tone].icon : undefined
}
