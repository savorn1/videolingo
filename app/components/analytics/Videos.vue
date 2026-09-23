<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Live videos"
        icon="i-lucide-video"
        :value="formatCount(data?.totalVideos)"
        :sublabel="data ? `${data.enabledVideos} enabled · ${data.disabledVideos} disabled · ${data.trashedVideos} in trash` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Uploads"
        icon="i-lucide-upload"
        :value="formatCount(data?.uploads.current)"
        :delta="data && describeDelta(data.uploads.current, data.uploads.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.uploads.previous) : ''"
        :loading="!data"
      />
      <KpiTile
        label="Total runtime"
        icon="i-lucide-clock"
        :value="formatWatchTime(data?.totalDurationSeconds)"
        :sublabel="data ? `Average ${formatDuration(data.averageDurationSeconds)} per video` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Never watched"
        icon="i-lucide-eye-off"
        :value="formatCount(data?.neverWatched)"
        sublabel="Live videos with no views at all"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard class="lg:col-span-2">
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`Uploads per ${uploads.per}`" :items="uploads.items" unit="uploads" value-label="Uploads" />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Content gaps</h3></template>
        <ul v-if="data" class="space-y-3 text-sm">
          <li v-for="gap in gaps" :key="gap.label" class="flex items-center justify-between gap-2">
            <span class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <UIcon :name="gap.icon" class="w-4 h-4 text-gray-400" />
              {{ gap.label }}
            </span>
            <span class="font-semibold tabular-nums" :class="gap.value ? 'text-warning-700 dark:text-warning-400' : 'text-gray-900 dark:text-white'">
              {{ gap.value }}
            </span>
          </li>
        </ul>
        <USkeleton v-else class="h-32" />
        <p class="text-xs text-gray-500 mt-3">Out of {{ data?.totalVideos ?? '…' }} live videos.</p>
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">By spoken language</h3></template>
        <RankedBarList
          :rows="(data?.byLanguage ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count, to: r.key ? `/videos?language=${r.key}` : undefined }))"
        />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">By category</h3></template>
        <RankedBarList
          :rows="(data?.byCategory ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count, to: `/videos?categoryId=${r.key}` }))"
          empty="No categorised videos."
        />
        <p class="text-xs text-gray-500 mt-3">A video can be in several categories.</p>
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          title="By length"
          :items="(data.byDuration ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count }))"
          :label-every="1"
          unit="videos"
          column-label="Length"
          value-label="Videos"
          height="9rem"
        />
      </UCard>
    </div>

    <UCard>
      <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Most watched in this period</h3></template>
      <USkeleton v-if="!data" class="h-40" />
      <AnalyticsTopVideosTable v-else :videos="data.topVideos" />
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('videos', toRef(props, 'range'))

const uploads = computed(() => trendItems(data.value?.uploadsDaily ?? []))
const gaps = computed(() => [
  { label: 'No transcript', icon: 'i-lucide-captions-off', value: data.value?.withoutTranscript ?? 0 },
  { label: 'No subtitles', icon: 'i-lucide-subtitles', value: data.value?.withoutSubtitles ?? 0 },
  { label: 'No category', icon: 'i-lucide-folder-x', value: data.value?.withoutCategory ?? 0 }
])
</script>
