// Keeps a list page's filters, search and page number in the URL, so they survive
// opening a record and coming back, a refresh, or sharing the link.
//
// Without this, every list page resets to "page 1, no filters" the moment you
// navigate away — which in an admin app is the single most repeated annoyance, since
// the normal workflow is filter → open a record → go back → open the next one.
//
// A page opts in with one line, after its filter/search state is declared and
// before the initial load:
//
//   useListQuerySync({ filter, search, page })
//
// Hydration happens synchronously during setup, so the values are already in
// place by the time onMounted calls load() — no wasted unfiltered first fetch.

import type { Ref } from 'vue'
import { buildListQuery, coerceQueryValue } from '#shared/utils/listQuery'

interface ListQueryState {
  /** The page's `reactive({...})` filter object. Keys become query params. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: Record<string, any>
  search?: Ref<string>
  page?: Ref<number>
}

export function useListQuerySync(state: ListQueryState) {
  const route = useRoute()
  const router = useRouter()

  // ── hydrate (synchronous, before the page's first load) ──────────────────
  const initial = route.query
  if (state.filter) {
    for (const key of Object.keys(state.filter)) {
      const raw = initial[key]
      if (typeof raw === 'string' && raw !== '') state.filter[key] = coerceQueryValue(raw)
    }
  }
  if (state.search && typeof initial.q === 'string') state.search.value = initial.q
  if (state.page && typeof initial.page === 'string') {
    const parsed = Number(initial.page)
    if (Number.isSafeInteger(parsed) && parsed > 0) state.page.value = parsed
  }

  // ── persist ──────────────────────────────────────────────────────────────
  function currentQuery(): Record<string, string> {
    return buildListQuery({
      filter: state.filter,
      search: state.search?.value,
      page: state.page?.value
    })
  }

  watch(
    () => currentQuery(),
    (query) => {
      // `replace`, not `push` — otherwise every keystroke in a search box becomes
      // a history entry and the back button walks through them one at a time
      // instead of leaving the page.
      //
      // Params this sync doesn't own (e.g. a page's own ?view= tab) are kept —
      // replacing the whole query used to silently drop them.
      const owned = new Set([...Object.keys(state.filter ?? {}), 'q', 'page'])
      const foreign = Object.fromEntries(Object.entries(route.query).filter(([key]) => !owned.has(key)))
      router.replace({ query: { ...foreign, ...query } })
    },
    { deep: true }
  )
}
