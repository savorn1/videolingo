<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Views"
        icon="i-lucide-play"
        :value="formatCount(data?.views.current)"
        :delta="data && describeDelta(data.views.current, data.views.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.views.previous) : ''"
        :sublabel="data ? `${formatCount(data.anonymousViews)} by visitors not signed in` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Watch time"
        icon="i-lucide-hourglass"
        :value="formatWatchTime(data?.watchSeconds.current)"
        :delta="data && describeDelta(data.watchSeconds.current, data.watchSeconds.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatWatchTime(data.watchSeconds.previous) : ''"
        :sublabel="data ? `${formatDuration(data.averageWatchSeconds)} per view on average` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Unique viewers"
        icon="i-lucide-users"
        :value="formatCount(data?.uniqueViewers.current)"
        :delta="data && describeDelta(data.uniqueViewers.current, data.uniqueViewers.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.uniqueViewers.previous) : ''"
        sublabel="Signed-in accounts"
        :loading="!data"
      />
      <KpiTile
        label="Finished"
        icon="i-lucide-flag"
        :value="formatPercent(data?.completionRate.current)"
        :delta="data && describeRateDelta(data.completionRate.current, data.completionRate.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatPercent(data.completionRate.previous) : ''"
        :sublabel="data?.averagePercentWatched != null ? `Viewers watch ${formatPercent(data.averagePercentWatched)} of a video on average` : ''"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`Views per ${views.per}`" :items="views.items" unit="views" value-label="Views" />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          :title="`Watch time per ${watch.per}`"
          :items="watch.items"
          :format="(v: number) => formatWatchTime(v)"
          :nice-top="niceSecondsTop"
          value-label="Watch time"
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard class="lg:col-span-2">
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          title="When people watch"
          subtitle="Views by hour of day (server time)"
          :items="(data.byHour ?? []).map((h) => ({ key: h.key, label: h.label, value: h.count }))"
          :label-every="3"
          unit="views"
          column-label="Hour"
          value-label="Views"
        />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          title="By weekday"
          :items="(data.byWeekday ?? []).map((d) => ({ key: d.key, label: d.label, value: d.count }))"
          :label-every="1"
          unit="views"
          column-label="Day"
          value-label="Views"
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Watch time by language</h3></template>
        <RankedBarList
          :rows="(data?.byLanguage ?? []).map((r) => ({ key: r.key, label: r.label, value: r.value, sub: `${formatCount(r.count)} views` }))"
          :format="(v: number) => formatWatchTime(v)"
        />
      </UCard>
      <UCard class="lg:col-span-2">
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Most watched</h3></template>
        <USkeleton v-if="!data" class="h-40" />
        <AnalyticsTopVideosTable v-else :videos="data.topVideos" />
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Passed as a prop value, so imported explicitly (template auto-imports only cover calls).
import { niceSecondsTop } from '#shared/utils/analytics'
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('watch', toRef(props, 'range'))

const views = computed(() => trendItems(data.value?.viewsDaily ?? []))
const watch = computed(() => trendItems(data.value?.watchSecondsDaily ?? []))
</script>
