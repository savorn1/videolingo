<template>
  <div>
    <PageHeader title="Analytics" description="How the platform is used — people, content, viewing, translation, storage and AI." />

    <!-- Sticky toolbar: section tabs on the left, period on the right -->
    <div
      class="sticky top-0 z-20 -mx-1 px-1 py-2 mb-4 bg-(--ui-bg)/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <UTabs v-model="tab" :items="tabItems" :content="false" size="sm" class="w-full lg:w-auto overflow-x-auto" />
      <div class="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        <p class="text-xs text-gray-500 leading-tight">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ formatDate(range.from) }} – {{ formatDate(range.to) }}</span>
          <br />
          <span class="text-gray-500 dark:text-gray-400">vs the {{ days }} days before</span>
        </p>
        <USelect v-model="rangeKey" :items="RANGE_PRESETS" icon="i-lucide-calendar" class="w-44" aria-label="Date range" />
      </div>
    </div>

    <!-- Each tab loads its own data, only when shown -->
    <Transition name="tab-fade" mode="out-in">
      <AnalyticsUsers v-if="tab === 'users'" key="users" :range="range" :compared-to="comparedTo" />
      <AnalyticsVideos v-else-if="tab === 'videos'" key="videos" :range="range" :compared-to="comparedTo" />
      <AnalyticsWatch v-else-if="tab === 'watch'" key="watch" :range="range" :compared-to="comparedTo" />
      <AnalyticsTranslations v-else-if="tab === 'translations'" key="translations" :range="range" :compared-to="comparedTo" />
      <AnalyticsLanguages v-else-if="tab === 'languages'" key="languages" :range="range" :compared-to="comparedTo" />
      <AnalyticsStorage v-else-if="tab === 'storage'" key="storage" :range="range" :compared-to="comparedTo" />
      <AnalyticsAi v-else key="ai" :range="range" :compared-to="comparedTo" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { RangeKey } from '#shared/utils/analytics'
import type { AnalyticsArea } from '~/composables/useAnalytics'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()

const tabItems: (TabsItem & { value: AnalyticsArea })[] = [
  { label: 'Users', value: 'users', icon: 'i-lucide-users' },
  { label: 'Videos', value: 'videos', icon: 'i-lucide-video' },
  { label: 'Watching', value: 'watch', icon: 'i-lucide-play' },
  { label: 'Translations', value: 'translations', icon: 'i-lucide-languages' },
  { label: 'Languages', value: 'languages', icon: 'i-lucide-globe' },
  { label: 'Storage', value: 'storage', icon: 'i-lucide-hard-drive' },
  { label: 'AI', value: 'ai', icon: 'i-lucide-sparkles' }
]

const initialTab = tabItems.find((t) => t.value === route.query.tab)?.value ?? 'users'
const initialRange = RANGE_PRESETS.find((r) => r.value === route.query.range)?.value ?? '30d'
const tab = ref<AnalyticsArea>(initialTab)
const rangeKey = ref<RangeKey>(initialRange)

const range = computed(() => rangeDates(rangeKey.value))
const days = computed(() => {
  const [fy, fm, fd] = range.value.from.split('-').map(Number)
  const [ty, tm, td] = range.value.to.split('-').map(Number)
  return Math.round((Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000) + 1
})
const comparedTo = computed(() => `vs previous ${days.value} days`)

// Keep tab and range in the URL so a view can be shared or refreshed.
watch([tab, rangeKey], ([t, r]) => {
  router.replace({ query: { ...route.query, tab: t === 'users' ? undefined : t, range: r === '30d' ? undefined : r } })
})
</script>

<style scoped>
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.tab-fade-enter-from,
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
@media (prefers-reduced-motion: reduce) {
  .tab-fade-enter-active,
  .tab-fade-leave-active {
    transition: none;
  }
}
</style>
