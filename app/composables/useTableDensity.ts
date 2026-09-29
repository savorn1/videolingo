export type TableDensity = 'comfortable' | 'compact'

// Same cookie-persisted pattern as useTableTheme, kept separate since density
// and color theme are independent choices — either can change without
// touching the other. `densityUi` is meant to be merged into whatever the
// table's own `ui` object already is (DataTable does this next to the theme).
export function useTableDensity() {
  const density = useCookie<TableDensity>('table_density', {
    default: () => 'comfortable',
    maxAge: 60 * 60 * 24 * 365
  })

  function setDensity(next: TableDensity) {
    density.value = next
  }

  const densityUi = computed(() =>
    density.value === 'compact' ? { td: 'py-1.5', th: 'py-1.5' } : {}
  )

  return { density, setDensity, densityUi }
}
