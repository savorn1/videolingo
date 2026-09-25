// The breadcrumb trail a page's PageHeader asks for (e.g. Videos › "Lesson 1"),
// read by the layout's top-bar breadcrumb. Tagged with the route path so a
// trail never shows on a page it doesn't belong to.

import type { BreadcrumbItem } from '@nuxt/ui'

export function usePageCrumbs() {
  return useState<{ path: string; items: BreadcrumbItem[] } | null>('page-crumbs', () => null)
}
