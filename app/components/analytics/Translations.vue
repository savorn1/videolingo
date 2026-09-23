<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Translations"
        icon="i-lucide-languages"
        :value="formatCount(data?.translations)"
        :sublabel="data ? `${formatCount(data.translatedWords)} words · ${data.translatedSubtitleTracks} subtitle tracks` : ''"
        :loading="!data"
      />
      <KpiTile
        label="New translations"
        icon="i-lucide-file-plus"
        :value="formatCount(data?.newTranslations.current)"
        :delta="data && describeDelta(data.newTranslations.current, data.newTranslations.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.newTranslations.previous) : ''"
        :loading="!data"
      />
      <KpiTile
        label="Videos translated"
        icon="i-lucide-video"
        :value="data ? `${data.videosTranslated} / ${data.liveVideos}` : '—'"
        :sublabel="
          data
            ? `${formatPercent(data.liveVideos ? data.videosTranslated / data.liveVideos : 0)} of live videos · ${data.averageTranslationsPerVideo.toFixed(1)} per video`
            : ''
        "
        :loading="!data"
      />
      <KpiTile
        label="Translate jobs succeeded"
        icon="i-lucide-cpu"
        :value="data?.jobSuccessRate != null ? formatPercent(data.jobSuccessRate) : '—'"
        :sublabel="data ? (data.averageJobSeconds != null ? `Average run ${formatDuration(data.averageJobSeconds)}` : 'No finished jobs in this period') : ''"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard class="lg:col-span-2">
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`Translations added per ${daily.per}`" :items="daily.items" unit="translations" value-label="Translations" />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          title="Coverage"
          subtitle="Live videos by number of translations"
          :items="data.coverage.map((c) => ({ key: c.key, label: c.key, tooltip: c.label, value: c.count }))"
          :label-every="1"
          unit="videos"
          column-label="Translations"
          value-label="Videos"
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Target languages</h3></template>
        <RankedBarList :rows="(data?.byTargetLanguage ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count }))" empty="No translations yet." />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Most common pairs</h3></template>
        <RankedBarList
          :rows="(data?.topPairs ?? []).map((p) => ({ key: `${p.from}-${p.to}`, label: `${languageLabel(p.from)} → ${languageLabel(p.to)}`, value: p.count }))"
          empty="No translations yet."
        />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">How they were made</h3></template>
        <RankedBarList :rows="(data?.bySource ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count }))" empty="No translations yet." />
        <p class="text-xs font-medium text-gray-500 mt-5 mb-2">Translate jobs started in this period</p>
        <p v-if="data && !data.jobsByStatus.length" class="text-sm text-gray-500">None.</p>
        <ul v-else class="space-y-1.5 text-sm">
          <li v-for="s in data?.jobsByStatus ?? []" :key="s.key" class="flex items-center justify-between">
            <StatusBadge :status="s.key" />
            <NuxtLink :to="`/processing-jobs?type=TRANSLATE&status=${s.key}`" class="tabular-nums hover:underline">{{ s.count }}</NuxtLink>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('translations', toRef(props, 'range'))

const daily = computed(() => trendItems(data.value?.translationsDaily ?? []))
</script>
