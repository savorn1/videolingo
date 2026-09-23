<template>
  <div>
    <PageHeader title="Analytics" description="How the platform is used — people, content, viewing, translation, storage and AI.">
      <template #actions>
        <USelect v-model="rangeKey" :items="RANGE_PRESETS" class="w-44" aria-label="Date range" />
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <UTabs v-model="tab" :items="tabItems" :content="false" class="w-full lg:w-auto overflow-x-auto" />
      <p class="text-sm text-gray-500">
        {{ formatDate(range.from) }} – {{ formatDate(range.to) }}
        <span class="text-gray-400">· compared with the {{ days }} days before</span>
      </p>
    </div>

    <!-- Each tab loads its own data, only when shown -->
    <AnalyticsUsers v-if="tab === 'users'" :range="range" :compared-to="comparedTo" />
    <AnalyticsVideos v-else-if="tab === 'videos'" :range="range" :compared-to="comparedTo" />
    <AnalyticsWatch v-else-if="tab === 'watch'" :range="range" :compared-to="comparedTo" />
    <AnalyticsTranslations v-else-if="tab === 'translations'" :range="range" :compared-to="comparedTo" />
    <AnalyticsLanguages v-else-if="tab === 'languages'" :range="range" :compared-to="comparedTo" />
    <AnalyticsStorage v-else-if="tab === 'storage'" :range="range" :compared-to="comparedTo" />
    <AnalyticsAi v-else :range="range" :compared-to="comparedTo" />
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
