<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile
        label="Video storage"
        icon="i-lucide-hard-drive"
        :value="data ? formatFileSize(data.storedBytes) : '—'"
        :sublabel="data ? `${data.storedVideos} files in the bucket · ${data.externalVideos} linked externally` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Uploaded"
        icon="i-lucide-upload-cloud"
        :value="data ? formatFileSize(data.uploadedBytes.current) : '—'"
        :delta="data && describeDelta(data.uploadedBytes.current, data.uploadedBytes.previous)"
        :compared-to="comparedTo"
        :previous-text="data ? formatFileSize(data.uploadedBytes.previous) : ''"
        sentiment="neutral"
        :loading="!data"
      />
      <KpiTile
        label="Held by trashed videos"
        icon="i-lucide-trash-2"
        :value="data ? formatFileSize(data.trashedBytes) : '—'"
        :sublabel="data ? `${data.trashedVideos} video(s) — still in the bucket until purged` : ''"
        :loading="!data"
      />
      <KpiTile
        label="Average file"
        icon="i-lucide-file-video"
        :value="data ? formatFileSize(data.averageFileBytes) : '—'"
        :sublabel="data?.unknownSizeVideos ? `${data.unknownSizeVideos} file(s) with unknown size aren't counted` : ''"
        :loading="!data"
      />
    </div>

    <UCard v-if="data?.quotaBytes" class="mb-4">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          <strong class="text-gray-900 dark:text-white">{{ formatFileSize(data.storedBytes) }}</strong> of the {{ formatFileSize(data.quotaBytes) }} quota
          <span class="text-gray-500">({{ quotaPercent }}%)</span>
        </p>
        <UBadge v-if="quotaPercent >= 100" color="error" variant="subtle" size="sm" icon="i-lucide-triangle-alert">Over quota</UBadge>
        <UBadge v-else-if="quotaPercent >= 80" color="warning" variant="subtle" size="sm" icon="i-lucide-triangle-alert">Nearly full</UBadge>
      </div>
      <UProgress
        :model-value="Math.min(quotaPercent, 100)"
        :color="quotaPercent >= 100 ? 'error' : quotaPercent >= 80 ? 'warning' : 'primary'"
        size="sm"
        class="mt-2"
        :aria-label="`${quotaPercent}% of the storage quota used`"
      />
      <p class="text-xs text-gray-500 mt-1.5">Quota set under Settings › Storage. Nothing is blocked when it's exceeded.</p>
    </UCard>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          variant="line"
          title="Stored over time"
          subtitle="Video files in the bucket, by upload date"
          :items="stored.items"
          :format="(v: number) => formatFileSize(v)"
          :nice-top="niceBytesTop"
          value-label="Stored"
        />
      </UCard>
      <UCard>
        <USkeleton v-if="!data" class="h-52" />
        <TrendChart
          v-else
          :title="`Uploaded per ${uploaded.per}`"
          :items="uploaded.items"
          :format="(v: number) => formatFileSize(v)"
          :nice-top="niceBytesTop"
          value-label="Uploaded"
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">By format</h3></template>
        <RankedBarList :rows="amountRows(data?.byMimeType)" :format="(v: number) => formatFileSize(v)" empty="No stored files." />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">By spoken language</h3></template>
        <RankedBarList :rows="amountRows(data?.byLanguage)" :format="(v: number) => formatFileSize(v)" empty="No stored files." />
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Top uploaders</h3></template>
        <RankedBarList
          :rows="amountRows(data?.byOwner, (key) => (key === 'none' ? undefined : `/users/${key}`))"
          :format="(v: number) => formatFileSize(v)"
          empty="No stored files."
        />
      </UCard>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <UCard class="lg:col-span-2">
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Largest files</h3></template>
        <p v-if="data && !data.largest.length" class="text-sm text-gray-500">No stored files.</p>
        <table v-else class="w-full text-sm">
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="f in data?.largest ?? []" :key="f.videoId">
              <td class="py-1.5 max-w-xs">
                <NuxtLink :to="`/videos/${f.videoId}`" class="block truncate hover:underline text-gray-900 dark:text-white" :title="f.title">{{
                  f.title
                }}</NuxtLink>
              </td>
              <td class="py-1.5 text-xs text-gray-500">{{ f.mimeType ?? '—' }}</td>
              <td class="py-1.5"><UBadge v-if="f.trashed" color="error" variant="subtle" size="sm" icon="i-lucide-trash-2">In trash</UBadge></td>
              <td class="py-1.5 text-right tabular-nums font-medium">{{ formatFileSize(f.bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </UCard>
      <UCard>
        <template #header><h3 class="font-semibold text-gray-900 dark:text-white">Text data</h3></template>
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-gray-500">Transcript segments</dt>
            <dd class="tabular-nums font-medium">{{ formatCount(data?.transcriptSegments) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-gray-500">Subtitle cues</dt>
            <dd class="tabular-nums font-medium">{{ formatCount(data?.subtitleCues) }}</dd>
          </div>
        </dl>
        <p class="text-xs text-gray-500 mt-4">
          Sizes are the ones recorded at upload. Files linked from another host aren't counted, and thumbnails and renditions aren't tracked.
        </p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
// Passed as a prop value, so imported explicitly (template auto-imports only cover calls).
import { niceBytesTop } from '#shared/utils/analytics'
import type { Amount } from '~/composables/useAnalytics'
import type { RankedRow } from '~/components/RankedBarList.vue'

const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('storage', toRef(props, 'range'))

const stored = computed(() => trendItems(data.value?.storedBytesDaily ?? [], 'last'))
const uploaded = computed(() => trendItems(data.value?.uploadedBytesDaily ?? []))
const quotaPercent = computed(() => (data.value?.quotaBytes ? Math.round((data.value.storedBytes / data.value.quotaBytes) * 100) : 0))

function amountRows(rows: Amount[] | undefined, link?: (key: string) => string | undefined): RankedRow[] {
  return (rows ?? []).map((r) => ({ key: r.key, label: r.label, value: r.value, sub: `${r.count} file${r.count === 1 ? '' : 's'}`, to: link?.(r.key) }))
}
</script>
