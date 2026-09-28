// Which course (collection) a video belongs to, from a learner's point of
// view — used by WatchHeader (breadcrumb, prev/next) and the watch page's
// end-of-video overlay ("next video in course"). One fetch, shared by both.
//
// The course is either the one named in the URL (?collection=<id>, e.g. a
// link from WatchHeader's own prev/next) or, failing that, a public course
// containing the video. If the video isn't actually in that course any more
// (a stale link, or it was removed), there's no course context at all.

import type { Collection, CollectionVideo } from './useCollections'

export interface VideoCourse {
  collection: Collection
  videos: CollectionVideo[]
}

export function useVideoCourse(videoId: Ref<number | null>) {
  const route = useRoute()
  const { collections, collection } = useLearn()

  const course = ref<VideoCourse | null>(null)
  const loading = ref(false)

  const courseIndex = computed(() => {
    if (!course.value || videoId.value == null) return -1
    return course.value.videos.findIndex((v) => v.videoId === videoId.value)
  })
  const prevItem = computed(() => (courseIndex.value > 0 ? course.value!.videos[courseIndex.value - 1]! : null))
  const nextItem = computed(() => (course.value && courseIndex.value >= 0 ? (course.value.videos[courseIndex.value + 1] ?? null) : null))

  function linkTo(targetVideoId: number) {
    return course.value ? `/learn/watch/${targetVideoId}?collection=${course.value.collection.id}` : `/learn/watch/${targetVideoId}`
  }

  let seq = 0
  async function load() {
    const id = videoId.value
    if (id == null) {
      course.value = null
      return
    }
    const mine = ++seq
    loading.value = true
    try {
      const wanted = Number(route.query.collection)
      const collectionId = Number.isFinite(wanted) && wanted > 0 ? wanted : (await collections({ videoId: id, size: 1 })).data[0]?.id
      const found = collectionId ? await collection(collectionId) : null
      if (mine !== seq) return
      // Only if the video is genuinely in it — a stale ?collection= link, or one it was removed from, isn't a course context.
      course.value = found && found.videos.some((v) => v.videoId === id) ? found : null
    } catch {
      if (mine === seq) course.value = null
    } finally {
      if (mine === seq) loading.value = false
    }
  }
  watch(videoId, load, { immediate: true })

  return { course, courseIndex, prevItem, nextItem, linkTo, loading }
}
