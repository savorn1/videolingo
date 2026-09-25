// Content search for the Cmd/Ctrl+K palette: videos, subtitle tracks,
// collections and glossaries by name — and what's *said* in the videos, via
// the transcript full-text search, landing on the exact moment. Each source
// is queried only if the account can read it, and one failing (or being
// forbidden) never hides the others.

export interface SearchResultItem {
  id: string
  label: string
  suffix?: string
  icon: string
  onSelect: () => void
}

export interface SearchResultGroup {
  id: string
  label: string
  items: SearchResultItem[]
  /** Results are already matched by the server. */
  ignoreFilter: true
}

const MIN_CHARS = 2
const PER_GROUP = 5

export function useGlobalSearch(term: Ref<string>) {
  const { can } = useAuth()
  const { list: listVideos } = useVideos()
  const { list: listSubtitles } = useSubtitles()
  const { list: listCollections } = useCollections()
  const { list: listGlossaries } = useGlossaries()
  const { search: searchTranscripts } = useTranscripts()

  const groups = ref<SearchResultGroup[]>([])
  const loading = ref(false)
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function run(q: string) {
    const mine = ++seq
    loading.value = true
    const go = (to: string) => () => navigateTo(to)
    const sources: Promise<SearchResultGroup | null>[] = [
      can('videos', 'READ')
        ? listVideos({ search: q, size: PER_GROUP }).then((r) => ({
            id: 'videos',
            label: 'Videos',
            ignoreFilter: true as const,
            items: r.data.map((v) => ({ id: `video-${v.id}`, label: v.title, icon: 'i-lucide-video', onSelect: go(`/videos/${v.id}`) }))
          }))
        : Promise.resolve(null),
      can('transcripts', 'READ')
        ? searchTranscripts({ q, size: PER_GROUP }).then((r) => ({
            id: 'spoken',
            label: 'Said in videos',
            ignoreFilter: true as const,
            items: r.data.map((h) => ({
              id: `seg-${h.segmentId}`,
              label: h.text,
              suffix: `${h.videoTitle} · ${formatTimestamp(h.startMs)} · ${h.language}`,
              icon: 'i-lucide-audio-lines',
              onSelect: go(`/transcripts/${h.transcriptId}?t=${h.startMs}`)
            }))
          }))
        : Promise.resolve(null),
      can('subtitles', 'READ')
        ? listSubtitles({ search: q, size: PER_GROUP }).then((r) => ({
            id: 'subtitles',
            label: 'Subtitle tracks',
            ignoreFilter: true as const,
            items: r.data.map((s) => ({
              id: `sub-${s.id}`,
              label: s.label,
              suffix: s.videoTitle ?? undefined,
              icon: 'i-lucide-subtitles',
              onSelect: go(`/subtitles/${s.id}`)
            }))
          }))
        : Promise.resolve(null),
      can('collections', 'READ')
        ? listCollections({ search: q, size: PER_GROUP }).then((r) => ({
            id: 'collections',
            label: 'Collections',
            ignoreFilter: true as const,
            items: r.data.map((c) => ({ id: `col-${c.id}`, label: c.title, icon: 'i-lucide-library', onSelect: go(`/collections/${c.id}`) }))
          }))
        : Promise.resolve(null),
      can('glossaries', 'READ')
        ? listGlossaries({ search: q, size: PER_GROUP }).then((r) => ({
            id: 'glossaries',
            label: 'Glossaries',
            ignoreFilter: true as const,
            items: r.data.map((g) => ({ id: `glo-${g.id}`, label: g.name, icon: 'i-lucide-book-a', onSelect: go(`/glossaries/${g.id}`) }))
          }))
        : Promise.resolve(null)
    ]
    const settled = await Promise.allSettled(sources)
    if (mine !== seq) return
    groups.value = settled.map((s) => (s.status === 'fulfilled' ? s.value : null)).filter((g): g is SearchResultGroup => !!g && g.items.length > 0)
    loading.value = false
  }

  watch(term, (value) => {
    clearTimeout(timer)
    const q = value.trim()
    if (q.length < MIN_CHARS) {
      seq++
      groups.value = []
      loading.value = false
      return
    }
    loading.value = true
    timer = setTimeout(() => run(q), 250)
  })

  return { groups, loading }
}
