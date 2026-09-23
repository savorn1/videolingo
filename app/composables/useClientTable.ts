type SortState = { column: string; direction: 'asc' | 'desc' } | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useClientTable<T extends Record<string, any>>(
  source: Ref<T[] | null | undefined>,
  options: { searchFields?: (keyof T)[]; pageSize?: number; cap?: number } = {}
) {
  const search = ref('')
  const page = ref(1)
  const sort = ref<SortState>(undefined)
  const pageSize = ref(options.pageSize ?? 10)

  const filtered = computed(() => {
    const rows = source.value ?? []
    const query = search.value.trim().toLowerCase()
    if (!query || !options.searchFields?.length) return rows
    return rows.filter((row) =>
      options.searchFields!.some((field) =>
        String(row[field] ?? '')
          .toLowerCase()
          .includes(query)
      )
    )
  })

  const sorted = computed(() => {
    const column = sort.value?.column
    const direction = sort.value?.direction
    if (!column) return filtered.value
    return [...filtered.value].sort((a, b) => {
      const av = a[column] as string | number
      const bv = b[column] as string | number
      if (av === bv) return 0
      if (direction === 'asc') return av < bv ? -1 : 1
      return av > bv ? -1 : 1
    })
  })

  const total = computed(() => sorted.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  // Callers fetch a single page of up to `cap` rows from the server (the
  // `size: 200` in their own `list()` call) and paginate/search/sort
  // client-side from there. If the source came back exactly at that cap,
  // there may be more matching rows sitting on the server that were never
  // fetched — `total` above would then silently undercount them. Default of
  // 200 matches every current caller's `size: 200`; pass `cap` explicitly if
  // a page ever fetches a different page size.
  const truncated = computed(() => (source.value?.length ?? 0) >= (options.cap ?? 200))

  const rows = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return sorted.value.slice(start, start + pageSize.value)
  })

  // Changing the page size (via <DataPagination>) invalidates the current
  // page offset the same way a new search or a refreshed source list does.
  watch([search, source, pageSize], () => {
    page.value = 1
  })
  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })

  // `filtered` is search-applied but unpaginated — for callers that need
  // every matching row at once (e.g. a kanban board grouped by column
  // instead of paginated), where slicing by page doesn't make sense.
  return { search, page, pageSize, sort, total, pageCount, rows, truncated, filtered }
}
