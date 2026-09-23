<template>
  <div>
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
      <KpiTile label="In the catalog" icon="i-lucide-book-open" :value="formatCount(data?.catalogLanguages)" :loading="!data" />
      <KpiTile label="Enabled" icon="i-lucide-toggle-right" :value="formatCount(data?.enabledLanguages)" :loading="!data" />
      <KpiTile
        label="In use"
        icon="i-lucide-check-circle"
        :value="formatCount(data?.languagesInUse)"
        sublabel="With videos, transcripts or subtitles"
        :loading="!data"
      />
      <KpiTile
        label="Not in the catalog"
        icon="i-lucide-circle-help"
        :value="formatCount(data?.unknownCodes)"
        sublabel="Codes used by content but not listed under Languages"
        :loading="!data"
      />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-gray-900 dark:text-white">Views by spoken language</h3>
          <p class="text-xs text-gray-500">In this period</p>
        </template>
        <RankedBarList
          :rows="
            inUse.filter((r) => r.views > 0).map((r) => ({ key: r.code, label: r.name, value: r.views, sub: `${formatWatchTime(r.watchSeconds)} watched` }))
          "
        />
      </UCard>
      <UCard class="lg:col-span-2">
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold text-gray-900 dark:text-white">All languages</h3>
            <USwitch v-model="showUnused" label="Show unused" size="sm" />
          </div>
        </template>
        <USkeleton v-if="!data" class="h-64" />
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-gray-500 text-left">
              <tr>
                <th class="pb-2 font-medium">Language</th>
                <th class="pb-2 font-medium text-right" title="Live videos spoken in it">Videos</th>
                <th class="pb-2 font-medium text-right">Transcripts</th>
                <th class="pb-2 font-medium text-right" title="Transcripts translated into it">Translated into</th>
                <th class="pb-2 font-medium text-right" title="Published / all subtitle tracks">Subtitles</th>
                <th class="pb-2 font-medium text-right" title="Views of videos spoken in it, this period">Views</th>
                <th class="pb-2 font-medium text-right" title="AI results written in it">AI results</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="r in shown" :key="r.code">
                <td class="py-1.5">
                  <span class="font-medium text-gray-900 dark:text-white">{{ r.name }}</span>
                  <code class="ml-1.5 text-xs text-gray-500">{{ r.code }}</code>
                  <UBadge v-if="r.isDefault" color="primary" variant="subtle" size="sm" class="ml-1.5">Default</UBadge>
                  <UBadge v-else-if="!r.inCatalog" color="warning" variant="subtle" size="sm" class="ml-1.5" icon="i-lucide-circle-help">Not in catalog</UBadge>
                  <UBadge v-else-if="!r.enabled" color="neutral" variant="subtle" size="sm" class="ml-1.5">Disabled</UBadge>
                </td>
                <td class="py-1.5 text-right tabular-nums">
                  <NuxtLink v-if="r.videos" :to="`/videos?language=${r.code}`" class="hover:underline">{{ r.videos }}</NuxtLink>
                  <span v-else class="text-gray-400">0</span>
                </td>
                <td class="py-1.5 text-right tabular-nums">{{ r.transcripts }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ r.translationsInto }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ r.publishedSubtitles }} / {{ r.subtitleTracks }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ formatCount(r.views) }}</td>
                <td class="py-1.5 text-right tabular-nums">{{ r.aiGenerations }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ range: { from: string; to: string }; comparedTo: string }>()
const { data, error } = useAnalyticsArea('languages', toRef(props, 'range'))

const showUnused = ref(false)
const used = (r: { videos: number; transcripts: number; subtitleTracks: number; views: number; aiGenerations: number }) =>
  r.videos + r.transcripts + r.subtitleTracks + r.views + r.aiGenerations > 0
const inUse = computed(() => (data.value?.languages ?? []).filter(used))
const shown = computed(() => (showUnused.value ? (data.value?.languages ?? []) : inUse.value))
</script>
