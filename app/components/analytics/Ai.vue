<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="AI requests"
        icon="i-lucide-sparkles"
        :value="formatCount(data?.requests.current)"
        :delta="data && describeDelta(data.requests.current, data.requests.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.requests.previous) : ''"
        :sublabel="data?.successRate != null ? `${formatPercent(data.successRate)} succeeded · ${data.videosWithAi} videos` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Cost"
        icon="i-lucide-dollar-sign"
        :value="formatUsd(data?.costUsd.current)"
        :delta="data && describeDelta(data.costUsd.current, data.costUsd.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatUsd(data.costUsd.previous) : ''"
        sentiment="up-bad"
        :loading="!data"
      />
      <KpiTile
        label="Generated results"
        icon="i-lucide-wand-sparkles"
        :value="formatCount(data?.generations.current)"
        :delta="data && describeDelta(data.generations.current, data.generations.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.generations.previous) : ''"
        sublabel="Summaries, chapters, key points, questions, quizzes"
        :loading="!data"
      />
      <KpiTile
        label="Chats started"
        icon="i-lucide-messages-square"
        :value="formatCount(data?.chats.current)"
        :delta="data && describeDelta(data.chats.current, data.chats.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatCount(data.chats.previous) : ''"
        :sublabel="data ? `${formatCount(data.chatMessages)} messages · ${data.averageMessagesPerChat.toFixed(1)} per chat` : ''"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`Requests per ${requests.per}`" :items="requests.items" unit="requests" value-label="Requests" />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart v-else :title="`Cost per ${cost.per}`" :items="cost.items" :format="(v: number) => formatUsd(v)" value-label="Cost" />
      </UCard>
    </div>

    <UCard class="mb-4">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h3 class="font-semibold text-gray-900 dark:text-white">By feature</h3>
          <UButton size="xs" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" to="/ai/usage">Request log</UButton>
        </div>
      </template>
      <USkeleton v-if="!data" class="h-40" />
      <p v-else-if="!data.byFeature.length" class="text-sm text-gray-500">No AI requests in this period.</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-xs text-gray-500 text-left">
            <tr>
              <th class="pb-2 font-medium">Feature</th>
              <th class="pb-2 font-medium text-right">Requests</th>
              <th class="pb-2 font-medium">Outcome</th>
              <th class="pb-2 font-medium text-right">Avg latency</th>
              <th class="pb-2 font-medium text-right">Avg tokens</th>
              <th class="pb-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="f in data.byFeature" :key="f.feature">
              <td class="py-2">
                <span class="flex items-center gap-1.5"
                  ><UIcon :name="aiFeatureIcon(f.feature)" class="w-4 h-4 text-gray-400" />{{ aiFeatureLabel(f.feature) }}</span
                >
              </td>
              <td class="py-2 text-right tabular-nums">{{ formatCount(f.requests) }}</td>
              <td class="py-2 min-w-56">
                <!-- Stacked outcome bar, status colours, 2px gaps; the legend below names each part -->
                <div class="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800" aria-hidden="true">
                  <div v-if="f.succeeded" class="bg-success-500" :style="{ width: share(f.succeeded, f.requests) }" />
                  <div v-if="f.refused + f.truncated" class="bg-warning-400" :style="{ width: share(f.refused + f.truncated, f.requests) }" />
                  <div v-if="f.errors" class="bg-error-500" :style="{ width: share(f.errors, f.requests) }" />
                </div>
                <p class="mt-1 text-xs text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-2 tabular-nums">
                  <span class="inline-flex items-center gap-0.5"><UIcon name="i-lucide-check" class="w-3 h-3 text-success-600" />{{ f.succeeded }} ok</span>
                  <span v-if="f.refused" class="inline-flex items-center gap-0.5"
                    ><UIcon name="i-lucide-hand" class="w-3 h-3 text-warning-600" />{{ f.refused }} declined</span
                  >
                  <span v-if="f.truncated" class="inline-flex items-center gap-0.5"
                    ><UIcon name="i-lucide-scissors" class="w-3 h-3 text-warning-600" />{{ f.truncated }} cut off</span
                  >
                  <span v-if="f.errors" class="inline-flex items-center gap-0.5"
                    ><UIcon name="i-lucide-circle-x" class="w-3 h-3 text-error-600" />{{ f.errors }} failed</span
                  >
                </p>
              </td>
              <td class="py-2 text-right tabular-nums">{{ f.averageLatencyMs != null ? `${(f.averageLatencyMs / 1000).toFixed(1)}s` : '—' }}</td>
              <td class="py-2 text-right tabular-nums">{{ formatTokens(f.averageTokens) }}</td>
              <td class="py-2 text-right tabular-nums font-medium">{{ formatUsd(f.costUsd) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Results by type</h3></template>
        <RankedBarList :rows="(data?.generationsByType ?? []).map((r) => ({ key: r.key, label: aiFeatureLabel(r.key), value: r.count }))" />
        <p class="text-xs font-medium text-gray-500 mt-5 mb-2">Written in</p>
        <RankedBarList :rows="(data?.generationsByLanguage ?? []).map((r) => ({ key: r.key, label: r.label, value: r.count }))" />
      </UCard>
      <UCard class="lg:col-span-2">
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Videos using the most AI</h3></template>
        <p v-if="data && !data.topVideos.length" class="text-sm text-gray-500">No AI requests in this period.</p>
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-gray-500 text-left">
            <tr>
              <th class="pb-2 font-medium">Video</th>
              <th class="pb-2 font-medium text-right">Requests</th>
              <th class="pb-2 font-medium text-right">Results</th>
              <th class="pb-2 font-medium text-right">Chats</th>
              <th class="pb-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="v in data?.topVideos ?? []" :key="v.videoId">
              <td class="py-1.5 max-w-xs">
                <NuxtLink :to="`/ai/videos/${v.videoId}`" class="block truncate hover:underline text-gray-900 dark:text-white" :title="v.title ?? undefined">
                  {{ v.title ?? `Video #${v.videoId}` }}
                </NuxtLink>
              </td>
              <td class="py-1.5 text-right tabular-nums">{{ formatCount(v.requests) }}</td>
              <td class="py-1.5 text-right tabular-nums">{{ v.generations }}</td>
              <td class="py-1.5 text-right tabular-nums">{{ v.chats }}</td>
              <td class="py-1.5 text-right tabular-nums font-medium">{{ formatUsd(v.costUsd) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('ai', toRef(props, 'range'))

const requests = computed(() => trendItems(data.value?.requestsDaily ?? []))
const cost = computed(() => trendItems(data.value?.costDaily ?? []))

function share(n: number, total: number) {
  return total ? `${(n / total) * 100}%` : '0%'
}
</script>
