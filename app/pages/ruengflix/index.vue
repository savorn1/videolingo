<template>
  <div>
    <PageHeader
      title="RuengFlix"
      description="The public streaming site. Series are collections with Show on RuengFlix switched on; here you see whether each one is live, what to fix, and how viewers respond."
    >
      <template #actions>
        <UButton v-if="data?.siteUrl" :to="data.siteUrl" target="_blank" color="neutral" variant="soft" icon="i-lucide-external-link">Open site</UButton>
        <UButton
          v-if="canWrite"
          icon="i-lucide-refresh-cw"
          :loading="refreshing"
          :disabled="!data?.siteConnected"
          :title="
            data?.siteConnected ? 'Show changes on the site now instead of within a minute' : 'Set RUENGFLIX_URL and RUENGFLIX_NOTIFY_SECRET on the server'
          "
          @click="onRefreshSite"
          >Refresh site</UButton
        >
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <!-- Status of the services behind the site -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <UCard v-for="c in checks" :key="c.name" :ui="{ body: 'p-4 sm:p-4' }">
        <div class="flex items-start gap-3">
          <UIcon
            :name="!c.configured ? 'i-lucide-circle-dashed' : c.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
            class="size-5 shrink-0 mt-0.5"
            :class="!c.configured ? 'text-muted' : c.ok ? 'text-success' : 'text-error'"
          />
          <div class="min-w-0">
            <p class="font-medium text-highlighted">{{ c.name }}</p>
            <p class="text-sm text-muted break-words">{{ c.detail }}</p>
            <p v-if="c.millis != null" class="text-xs text-dimmed">{{ c.millis }} ms</p>
          </div>
        </div>
      </UCard>
      <template v-if="statusLoading && !checks.length">
        <USkeleton v-for="i in 3" :key="i" class="h-20" />
      </template>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <StatTile
        label="Live series"
        :value="formatCount(liveCount)"
        :sublabel="`of ${formatCount(data?.series.length ?? 0)} switched on`"
        icon="i-lucide-radio"
        color="success"
        :loading="loading && !data"
      />
      <StatTile label="Plays" :value="formatCount(sum('starts'))" :sublabel="finishLabel" icon="i-lucide-play" :loading="loading && !data" />
      <StatTile label="Telegram followers" :value="formatCount(followerCount)" icon="i-lucide-bell-ring" color="info" :loading="loading && !data" />
      <StatTile
        label="Open problem reports"
        :value="formatCount(openReports)"
        icon="i-lucide-flag"
        :color="openReports ? 'warning' : 'neutral'"
        to="/ruengflix/reports"
        :loading="loading && !data"
      />
    </div>

    <UCard class="mb-4">
      <template #header>
        <h2 class="font-semibold text-highlighted">Series</h2>
      </template>
      <DataTable :rows="data?.series ?? []" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #title-data="{ row }">
          <NuxtLink :to="`/ruengflix/${row.id}`" class="flex items-center gap-3 min-w-0 group">
            <img v-if="row.coverUrl" :src="row.coverUrl" alt="" class="w-9 h-12 rounded object-cover shrink-0 bg-elevated" loading="lazy" />
            <div v-else class="w-9 h-12 rounded bg-elevated shrink-0" />
            <div class="min-w-0">
              <p class="font-medium text-highlighted truncate group-hover:underline">{{ row.title }}</p>
              <p class="text-xs text-muted">
                {{ row.category ? formatEnum(row.category) : 'No category' }}<template v-if="row.vip"> · VIP after {{ row.freeEpisodes }}</template>
              </p>
            </div>
          </NuxtLink>
        </template>
        <template #state-data="{ row }">
          <UBadge :color="SERIES_STATE_META[row.state].color" variant="subtle" :icon="SERIES_STATE_META[row.state].icon">{{
            SERIES_STATE_META[row.state].label
          }}</UBadge>
        </template>
        <template #episodes-data="{ row }">
          <span>{{ row.episodes }}</span>
          <span v-if="row.scheduled" class="text-xs text-muted" :title="row.nextEpisodeAt ? `Next ${formatDateTime(row.nextEpisodeAt)}` : undefined">
            +{{ row.scheduled }} scheduled</span
          >
        </template>
        <template #plays-data="{ row }">
          <span>{{ formatCount(row.totals.starts) }}</span>
          <span v-if="finishPercent(row.totals.starts, row.totals.completes) != null" class="text-xs text-muted">
            · {{ finishPercent(row.totals.starts, row.totals.completes) }}% finish</span
          >
        </template>
        <template #likes-data="{ row }">
          <span v-if="likePercent(row.totals.likes, row.totals.dislikes) != null" :title="`${row.totals.likes} 👍 · ${row.totals.dislikes} 👎`">
            {{ likePercent(row.totals.likes, row.totals.dislikes) }}% 👍
          </span>
          <span v-else class="text-muted">—</span>
        </template>
        <template #openReports-data="{ row }">
          <UBadge v-if="row.openReports" color="warning" variant="subtle">{{ row.openReports }}</UBadge>
          <span v-else class="text-muted">0</span>
        </template>
        <template #problems-data="{ row }">
          <UTooltip v-if="row.problems.length" :text="row.problems.map((p: SeriesProblem) => p.message).join(' · ')">
            <UBadge :color="row.problems.some((p: SeriesProblem) => p.level === 'ERROR') ? 'error' : 'warning'" variant="subtle" icon="i-lucide-list-checks"
              >{{ row.problems.length }} to fix</UBadge
            >
          </UTooltip>
          <UBadge v-else color="success" variant="subtle" icon="i-lucide-check">Ready</UBadge>
        </template>
        <template #featuredRank-data="{ row }">
          <span v-if="row.featuredRank">#{{ row.featuredRank }}</span>
          <span v-else class="text-muted">—</span>
        </template>
        <template #actions-data="{ row }">
          <div class="flex justify-end gap-1">
            <UButton
              v-if="ruengflixUrl(data?.siteUrl ?? '', row.id) && row.state === 'LIVE'"
              :to="ruengflixUrl(data?.siteUrl ?? '', row.id)!"
              target="_blank"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-external-link"
              aria-label="Open on RuengFlix"
              title="Open on RuengFlix"
            />
            <UButton
              :to="`/collections/${row.id}`"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit collection"
              title="Edit collection"
            />
          </div>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-tv"
            title="No series yet"
            description="Edit a collection and switch on Show on RuengFlix. Public collections with released videos appear on the site."
          >
            <template #action>
              <UButton to="/collections" icon="i-lucide-library">Go to collections</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </UCard>

    <!-- Hero order -->
    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-semibold text-highlighted">Home hero</h2>
            <p class="text-sm text-muted">
              Series in the big slider at the top of the home page, in this order. With none picked, the site shows its newest series.
            </p>
          </div>
          <div v-if="canWrite" class="flex gap-2">
            <UButton v-if="heroDirty" color="neutral" variant="ghost" @click="resetHero">Undo changes</UButton>
            <UButton icon="i-lucide-save" :loading="savingHero" :disabled="!heroDirty" @click="onSaveHero">Save order</UButton>
          </div>
        </div>
      </template>
      <ol v-if="hero.length" class="divide-y divide-default">
        <li v-for="(s, i) in hero" :key="s.id" class="flex items-center gap-3 py-2">
          <span class="w-6 text-right text-sm text-muted tabular-nums">{{ i + 1 }}</span>
          <span class="flex-1 min-w-0 truncate">{{ s.title }}</span>
          <UBadge v-if="s.state !== 'LIVE'" color="warning" variant="subtle" size="sm">Not live</UBadge>
          <template v-if="canWrite">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-up"
              :disabled="i === 0"
              aria-label="Move up"
              @click="hero = moveItem(hero, i, i - 1)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-down"
              :disabled="i === hero.length - 1"
              aria-label="Move down"
              @click="hero = moveItem(hero, i, i + 1)"
            />
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Remove from hero"
              @click="hero = hero.filter((h) => h.id !== s.id)"
            />
          </template>
        </li>
      </ol>
      <p v-else class="text-sm text-muted">No hero picks: the newest series are shown.</p>
      <div v-if="canWrite && heroCandidates.length" class="mt-3 max-w-sm">
        <USelectMenu
          v-model="heroToAdd"
          :items="heroCandidates"
          value-key="value"
          placeholder="Add a series to the hero…"
          :search-input="{ placeholder: 'Search series…' }"
          aria-label="Add a series to the hero"
          class="w-full"
        />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { SeriesProblem, ServiceCheck, StreamingOverview, StreamingSeriesSummary } from '~/composables/useStreaming'
import { SERIES_STATE_META, finishPercent, likePercent, ruengflixUrl } from '#shared/utils/ruengflix'
import { moveItem } from '#shared/utils/reorder'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const data = ref<StreamingOverview | null>(null)
const loading = ref(false)
const error = ref('')
const checks = ref<ServiceCheck[]>([])
const statusLoading = ref(false)
const refreshing = ref(false)

const columns: ColumnDef<StreamingSeriesSummary>[] = [
  { key: 'title', label: 'Series' },
  { key: 'state', label: 'On the site', value: (r) => SERIES_STATE_META[r.state].label },
  { key: 'episodes', label: 'Episodes' },
  { key: 'plays', label: 'Plays', value: (r) => r.totals.starts },
  { key: 'likes', label: 'Votes', value: (r) => likePercent(r.totals.likes, r.totals.dislikes) },
  { key: 'followers', label: 'Followers', type: 'number' },
  { key: 'openReports', label: 'Open reports' },
  { key: 'problems', label: 'Checklist', value: (r) => r.problems.length },
  { key: 'featuredRank', label: 'Hero' },
  { key: 'actions', label: '' }
]

const liveCount = computed(() => data.value?.series.filter((s) => s.state === 'LIVE').length ?? 0)
const followerCount = computed(() => data.value?.series.reduce((n, s) => n + s.followers, 0) ?? 0)
const openReports = computed(() => data.value?.series.reduce((n, s) => n + s.openReports, 0) ?? 0)
const sum = (key: 'starts' | 'completes') => data.value?.series.reduce((n, s) => n + s.totals[key], 0) ?? 0
const finishLabel = computed(() => {
  const p = finishPercent(sum('starts'), sum('completes'))
  return p == null ? 'none yet' : `${p}% watched to the end`
})

// Hero order: edited locally, saved as a whole
const hero = ref<StreamingSeriesSummary[]>([])
const savedHero = computed(() =>
  (data.value?.series ?? []).filter((s) => s.featuredRank != null).sort((a, b) => a.featuredRank! - b.featuredRank! || a.id - b.id)
)
const heroDirty = computed(() => hero.value.map((s) => s.id).join() !== savedHero.value.map((s) => s.id).join())
const heroCandidates = computed(() =>
  (data.value?.series ?? []).filter((s) => !hero.value.some((h) => h.id === s.id)).map((s) => ({ label: s.title, value: s.id }))
)
const heroToAdd = ref<number | undefined>()
const savingHero = ref(false)
watch(heroToAdd, (id) => {
  if (id == null) return
  const s = data.value?.series.find((x) => x.id === id)
  if (s) hero.value = [...hero.value, s]
  nextTick(() => (heroToAdd.value = undefined))
})
function resetHero() {
  hero.value = [...savedHero.value]
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await streaming.overview()
    resetHero()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadStatus() {
  statusLoading.value = true
  try {
    checks.value = (await streaming.status()).checks
  } catch {
    checks.value = []
  } finally {
    statusLoading.value = false
  }
}

async function onSaveHero() {
  savingHero.value = true
  try {
    data.value = await streaming.saveFeatured(hero.value.map((s) => s.id))
    resetHero()
    toast.add({ title: 'Hero order saved', description: 'The site shows it within a minute, or now with Refresh site.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not save the hero order', description: apiErrorMessage(err), color: 'error' })
  } finally {
    savingHero.value = false
  }
}

async function onRefreshSite() {
  refreshing.value = true
  try {
    const r = await streaming.refreshSite()
    toast.add({ title: 'RuengFlix refreshed', description: r.series != null ? `It now lists ${r.series} series.` : undefined, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not refresh RuengFlix', description: apiErrorMessage(err), color: 'error' })
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  load()
  loadStatus()
})
</script>
