<template>
  <div>
    <PageHeader title="Analytics" description="How the platform is used — people, content, viewing, translation, storage and AI." />

    <!-- Sticky toolbar: section tabs on the left, period on the right -->
    <div
      class="sticky top-0 z-20 -mx-1 px-1 py-2 mb-4 bg-(--ui-bg)/90 backdrop-blur border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <UTabs
        v-model="tab"
        :items="tabItems"
        :content="false"
        variant="pill"
        size="sm"
        class="w-full lg:w-auto overflow-x-auto"
        :ui="{ indicator: ANALYTICS_ACCENTS[tab].indicator }"
      />
      <div class="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
        <p class="text-xs text-gray-500 leading-tight">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ formatDate(range.from) }} – {{ formatDate(range.to) }}</span>
          <br />
          <span class="text-gray-500 dark:text-gray-400">vs the {{ days }} days before</span>
        </p>
        <USelect v-model="rangeKey" :items="RANGE_PRESETS" icon="i-lucide-calendar" class="w-44" aria-label="Date range" />
        <!-- When the numbers were fetched, and a way to fetch them again -->
        <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          <span v-if="updatedAt" class="hidden sm:inline whitespace-nowrap" data-testid="analytics-updated">Updated {{ updatedLabel }}</span>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            aria-label="Refresh the numbers"
            title="Fetch the numbers again"
            @click="refreshTick++"
          />
        </div>
      </div>
      <!-- A range of your own: two dates, checked before anything is fetched -->
      <div v-if="rangeKey === 'custom'" class="flex w-full flex-wrap items-center justify-end gap-2" data-testid="custom-range">
        <UInput v-model="customFrom" type="date" size="sm" class="w-40" aria-label="From" :max="customTo || today" />
        <span class="text-sm text-gray-500 dark:text-gray-400">–</span>
        <UInput v-model="customTo" type="date" size="sm" class="w-40" aria-label="To" :min="customFrom" :max="today" />
        <p v-if="customProblem" class="text-xs text-error-600 dark:text-error-400" role="alert">{{ customProblem }}</p>
      </div>
    </div>

    <!-- Each tab loads its own data, only when shown -->
    <!-- The wrapper takes the area's colour, so everything drawn in "primary" inside it (tiles, sparklines, bars) matches its tab -->
    <div :class="ANALYTICS_ACCENTS[tab].scope">
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
  </div>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { daysInRange, validateCustomRange, type RangeKey } from '#shared/utils/analytics'
import { ANALYTICS_ACCENTS } from '#shared/utils/analyticsAccent'
import type { AnalyticsArea } from '~/composables/useAnalytics'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const router = useRouter()

const tabItems: (TabsItem & { value: AnalyticsArea })[] = (
  [
    { label: 'Users', value: 'users', icon: 'i-lucide-users' },
    { label: 'Videos', value: 'videos', icon: 'i-lucide-video' },
    { label: 'Watching', value: 'watch', icon: 'i-lucide-play' },
    { label: 'Translations', value: 'translations', icon: 'i-lucide-languages' },
    { label: 'Languages', value: 'languages', icon: 'i-lucide-globe' },
    { label: 'Storage', value: 'storage', icon: 'i-lucide-hard-drive' },
    { label: 'AI', value: 'ai', icon: 'i-lucide-sparkles' }
  ] as { label: string; value: AnalyticsArea; icon: string }[]
).map((t) => ({ ...t, ui: ANALYTICS_ACCENTS[t.value].ui }))

const initialTab = tabItems.find((t) => t.value === route.query.tab)?.value ?? 'users'
const initialRange = RANGE_PRESETS.find((r) => r.value === route.query.range)?.value ?? '30d'
const tab = ref<AnalyticsArea>(initialTab)
const rangeKey = ref<RangeKey>(initialRange)

// A range typed by hand: starts as the last 30 days and is only used once it is valid (see rangeDates).
const today = rangeDates('7d').to
const initialCustom = rangeDates('30d')
const customFrom = ref(typeof route.query.from === 'string' ? route.query.from : initialCustom.from)
const customTo = ref(typeof route.query.to === 'string' ? route.query.to : initialCustom.to)
const customProblem = computed(() => (rangeKey.value === 'custom' ? validateCustomRange(customFrom.value, customTo.value) : null))
const range = computed(() => rangeDates(rangeKey.value, new Date(), { from: customFrom.value, to: customTo.value }))
const days = computed(() => daysInRange(range.value.from, range.value.to))

// When the numbers on screen were fetched (set by each area as it loads), and the Refresh button.
const updatedAt = useState<number | null>('analytics-updated', () => null)
const refreshTick = useState<number>('analytics-refresh', () => 0)
const updatedLabel = computed(() => (updatedAt.value ? new Date(updatedAt.value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''))
const comparedTo = computed(() => `vs previous ${days.value} days`)

// Keep tab and range in the URL so a view can be shared or refreshed.
watch([tab, rangeKey, customFrom, customTo], ([t, r, f, to]) => {
  router.replace({
    query: {
      ...route.query,
      tab: t === 'users' ? undefined : t,
      range: r === '30d' ? undefined : r,
      from: r === 'custom' ? f : undefined,
      to: r === 'custom' ? to : undefined
    }
  })
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
