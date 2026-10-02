<template>
  <header class="mb-4 space-y-2">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{{ video.title }}</h1>
        <!-- What it is, at a glance -->
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <UBadge v-if="video.language" color="neutral" variant="subtle" icon="i-lucide-mic">{{ languageLabel(video.language) }}</UBadge>
          <UBadge v-if="video.durationSeconds" color="neutral" variant="subtle" icon="i-lucide-clock">{{ formatDuration(video.durationSeconds) }}</UBadge>
          <UTooltip v-if="level" text="Estimated CEFR level (from the AI summary)">
            <UBadge color="primary" variant="solid">{{ level }}</UBadge>
          </UTooltip>
          <UTooltip v-if="subtitleLanguages.length" :text="`Subtitles: ${subtitleLanguages.map(languageLabel).join(', ')}`">
            <UBadge color="neutral" variant="subtle" icon="i-lucide-subtitles">
              {{
                subtitleLanguages
                  .slice(0, 4)
                  .map((l) => l.toUpperCase())
                  .join(' · ')
              }}{{ subtitleLanguages.length > 4 ? ` +${subtitleLanguages.length - 4}` : '' }}
            </UBadge>
          </UTooltip>
          <UTooltip v-if="voiceOvers.length" :text="`Voice-overs: ${voiceOvers.join(', ')}`">
            <UBadge color="neutral" variant="subtle" icon="i-lucide-audio-lines"
              >{{ voiceOvers.length }} voice-over{{ voiceOvers.length === 1 ? '' : 's' }}</UBadge
            >
          </UTooltip>
          <CategoryBadge v-for="c in video.categories.slice(0, 3)" :key="c.id" :name="c.name" :color="c.color" :enabled="c.enabled" />
          <span v-if="video.sourceAuthor" class="text-gray-500">by {{ video.sourceAuthor }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <UButton
          :color="progress?.completed ? 'success' : 'neutral'"
          variant="soft"
          :icon="progress?.completed ? 'i-lucide-circle-check' : 'i-lucide-circle'"
          :loading="marking"
          @click="emit('toggleWatched')"
        >
          {{ progress?.completed ? 'Watched' : 'Mark as watched' }}
        </UButton>
        <UDropdownMenu :items="menu" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-ellipsis" aria-label="More" />
        </UDropdownMenu>
      </div>
    </div>

    <SaveToPlaylistModal v-model:open="showSave" :video-id="video.id" />

    <!-- Where you are: your progress, and the course this video belongs to -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <template v-if="progress?.completed">
          <UIcon name="i-lucide-circle-check" class="w-4 h-4 text-success-600 dark:text-success-500" />
          <span>Watched{{ progress.completedAt ? ` ${formatRelativeTime(progress.completedAt)}` : '' }}</span>
        </template>
        <template v-else>
          <UProgress :model-value="percent" size="xs" class="w-32" />
          <span class="tabular-nums"
            >{{ percent ? `${percent}% watched` : 'Not started'
            }}<template v-if="leftSeconds && percent"> · {{ formatDuration(leftSeconds) }} left</template></span
          >
        </template>
      </div>

      <div v-if="course" class="flex items-center gap-1 text-sm">
        <UIcon name="i-lucide-library" class="w-4 h-4 text-gray-400" />
        <NuxtLink :to="`/learn/collections/${course.collection.id}`" class="font-medium text-gray-700 dark:text-gray-200 hover:underline truncate max-w-56">
          {{ course.collection.title }}
        </NuxtLink>
        <span class="text-gray-500 tabular-nums">· {{ courseIndex + 1 }} of {{ course.videos.length }}</span>
        <UTooltip :text="prevItem ? `Previous: ${prevItem.title ?? ''}` : 'This is the first video'">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-chevron-left"
            aria-label="Previous video in the course"
            :disabled="!prevItem"
            :to="prevItem ? linkTo(prevItem.videoId) : undefined"
          />
        </UTooltip>
        <UTooltip :text="nextItem ? `Next: ${nextItem.title ?? ''}` : 'This is the last video'">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-chevron-right"
            aria-label="Next video in the course"
            :disabled="!nextItem"
            :to="nextItem ? linkTo(nextItem.videoId) : undefined"
          />
        </UTooltip>
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-list-video" :to="`/collections/${course.collection.id}/play?v=${video.id}`">
          Play course
        </UButton>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// The top of the learner watch page: what the video is (language, length,
// level, subtitles), how far you've got, which course it belongs to (with
// previous / next), and actions. Also sets the top-bar breadcrumb.
//
// The course itself is fetched once by the page (useVideoCourse) and handed
// down as a prop — the end-of-video overlay needs the same data, so it isn't
// fetched twice.
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CollectionVideo } from '~/composables/useCollections'
import type { StudyItem, WatchPage } from '~/composables/useLearn'
import type { VideoCourse } from '~/composables/useVideoCourse'
import type { WatchProgress } from '~/composables/useWatchProgress'

const props = defineProps<{
  page: WatchPage
  progress: WatchProgress | null
  /** Live player position, so the bar moves while watching. */
  currentMs: number
  studyItems: StudyItem[]
  marking?: boolean
  course: VideoCourse | null
  prevItem: CollectionVideo | null
  nextItem: CollectionVideo | null
  linkTo: (videoId: number) => string
}>()
const emit = defineEmits<{ toggleWatched: [] }>()

const route = useRoute()
const toast = useToast()
const { can } = useAuth()

const video = computed(() => props.page.video)
const subtitleLanguages = computed(() => [...new Set(props.page.tracks.map((t) => t.language))])
const voiceOvers = computed(() => props.page.voiceOvers.map((d) => d.languageName))
const level = computed(() => {
  const summary = props.studyItems.find((i) => i.type === 'SUMMARY')?.content as { estimatedLevel?: string } | undefined
  return summary?.estimatedLevel ?? null
})

// ── Progress: the saved position, moving on as the video plays ─────────────
const durationMs = computed(() => (video.value.durationSeconds ?? props.progress?.durationSeconds ?? 0) * 1000)
const percent = computed(() => {
  const saved = props.progress?.percent ?? 0
  const live = durationMs.value ? Math.round((props.currentMs / durationMs.value) * 100) : 0
  return Math.min(100, Math.max(saved, live))
})
const leftSeconds = computed(() => (durationMs.value ? Math.max(0, Math.round((durationMs.value - props.currentMs) / 1000)) : 0))

const course = computed(() => props.course)
const courseIndex = computed(() => course.value?.videos.findIndex((v) => v.videoId === video.value.id) ?? -1)

// ── Breadcrumb (Learn › course › video), handed to the layout like PageHeader does ──
// Previous / next keep this component and change the URL, so follow route.path.
const pageCrumbs = usePageCrumbs()
let crumbPath = route.path
watchEffect(() => {
  crumbPath = route.path
  pageCrumbs.value = {
    path: crumbPath,
    items: [
      { label: 'Learn', to: '/learn' },
      ...(course.value ? [{ label: course.value.collection.title, to: `/learn/collections/${course.value.collection.id}` }] : []),
      { label: video.value.title }
    ]
  }
})
onBeforeUnmount(() => {
  if (pageCrumbs.value?.path === crumbPath) pageCrumbs.value = null
})

// ── Actions ────────────────────────────────────────────────────────────────
async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `${what} copied`, color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy', description: text, color: 'warning' })
  }
}
const isPlatform = computed(() => ['YOUTUBE', 'VIMEO', 'FACEBOOK'].includes(video.value.source))
const originalUrl = computed(() => video.value.importedFrom ?? (isPlatform.value ? video.value.videoUrl : null))
const showSave = ref(false)
const menu = computed<DropdownMenuItem[][]>(() => {
  // Rendered on the server too, where there's no window (links are only copied in the browser).
  const origin = import.meta.client ? window.location.origin : ''
  const base = `${origin}/learn/watch/${video.value.id}`
  return [
    [
      { label: 'Save to a playlist', icon: 'i-lucide-list-plus', onSelect: () => (showSave.value = true) },
      { label: 'Copy link', icon: 'i-lucide-link', onSelect: () => copy(base, 'Link') },
      {
        label: `Copy link at ${formatDuration(Math.floor(props.currentMs / 1000))}`,
        icon: 'i-lucide-clock',
        disabled: props.currentMs < 1000,
        onSelect: () => copy(`${base}?t=${Math.floor(props.currentMs)}`, 'Link to this moment')
      }
    ],
    [
      ...(originalUrl.value ? [{ label: 'Open original', icon: 'i-lucide-external-link', to: originalUrl.value, target: '_blank' }] : []),
      ...(can('videos', 'READ') ? [{ label: 'Manage video', icon: 'i-lucide-settings-2', to: `/videos/${video.value.id}` }] : [])
    ]
  ].filter((g) => g.length)
})
</script>
