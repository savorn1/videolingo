<template>
  <div>
    <PageHeader
      :title="series?.title ?? 'Series'"
      :description="series ? `${SERIES_STATE_META[series.state].label} on RuengFlix · ${series.episodes} episodes` : undefined"
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: series?.title ?? '…' }]"
    >
      <template #actions>
        <UButton v-if="seriesLink && series?.state === 'LIVE'" :to="seriesLink" target="_blank" color="neutral" variant="soft" icon="i-lucide-external-link"
          >Open on RuengFlix</UButton
        >
        <UButton :to="`/collections/${id}`" color="neutral" variant="soft" icon="i-lucide-pencil">Edit collection</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />
    <DetailSkeleton v-if="loading && !detail" />

    <template v-if="detail && series">
      <!-- Checklist -->
      <UCard class="mb-4">
        <template #header>
          <h2 class="font-semibold text-highlighted">Checklist</h2>
        </template>
        <ul v-if="series.problems.length" class="space-y-2">
          <li v-for="p in series.problems" :key="p.message" class="flex items-start gap-2 text-sm">
            <UIcon
              :name="p.level === 'ERROR' ? 'i-lucide-circle-x' : 'i-lucide-triangle-alert'"
              class="size-4 mt-0.5 shrink-0"
              :class="p.level === 'ERROR' ? 'text-error' : 'text-warning'"
            />
            <span>{{ p.message }}</span>
          </li>
        </ul>
        <p v-else class="flex items-center gap-2 text-sm text-success"><UIcon name="i-lucide-circle-check" class="size-4" /> Ready: nothing to fix.</p>
        <p v-if="series.nextEpisodeAt" class="text-sm text-muted mt-3">
          Next scheduled episode: {{ formatDateTime(series.nextEpisodeAt) }} ({{ formatTimeUntil(series.nextEpisodeAt) }}).
        </p>
      </UCard>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatTile label="Plays" :value="formatCount(series.totals.starts)" :sublabel="finishSub" icon="i-lucide-play" />
        <StatTile
          label="Votes"
          :value="likeValue"
          :sublabel="`${series.totals.likes} 👍 · ${series.totals.dislikes} 👎`"
          icon="i-lucide-thumbs-up"
          color="success"
        />
        <StatTile label="Telegram followers" :value="formatCount(series.followers)" icon="i-lucide-bell-ring" color="info" />
        <StatTile
          label="Open problem reports"
          :value="formatCount(series.openReports)"
          icon="i-lucide-flag"
          :color="series.openReports ? 'warning' : 'neutral'"
          :to="`/ruengflix/reports?series=${id}`"
        />
      </div>

      <!-- Episodes -->
      <UCard class="mb-4">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="font-semibold text-highlighted">Episodes</h2>
              <p class="text-sm text-muted">
                Continue = of the plays that finished an episode, how many started the next.<template v-if="dropOff">
                  Most viewers stop after episode {{ dropOff }}.</template
                >
              </p>
            </div>
            <UButton
              v-if="canWrite && (series.totals.likes || series.totals.dislikes)"
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-eraser"
              @click="confirmReset = { episode: null }"
              >Reset all votes</UButton
            >
          </div>
        </template>
        <DataTable :rows="episodeRows" :columns="episodeColumns" :columns-toggleable="false" row-key="number">
          <template #number-data="{ row }">
            <span class="tabular-nums" :class="row.number === dropOff ? 'font-semibold text-warning' : ''">{{ row.number }}</span>
          </template>
          <template #title-data="{ row }">
            <NuxtLink :to="`/videos/${row.videoId}`" class="hover:underline">{{ row.title }}</NuxtLink>
            <div class="flex gap-1 mt-0.5">
              <UBadge v-if="row.locked" size="sm" color="warning" variant="subtle" icon="i-lucide-lock">VIP</UBadge>
              <UBadge v-if="!row.subtitled" size="sm" color="neutral" variant="subtle" icon="i-lucide-captions-off">No subtitles</UBadge>
            </div>
          </template>
          <template #finish-data="{ row }">{{ row.finish == null ? '—' : `${row.finish}%` }}</template>
          <template #continue-data="{ row }">
            <span :class="row.number === dropOff ? 'font-semibold text-warning' : ''">{{ row.continue == null ? '—' : `${row.continue}%` }}</span>
          </template>
          <template #votes-data="{ row }">
            <span v-if="row.likes || row.dislikes">{{ row.likes }} 👍 · {{ row.dislikes }} 👎</span>
            <span v-else class="text-muted">—</span>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                v-if="ruengflixUrl(detail.siteUrl, id, row.number)"
                :to="ruengflixUrl(detail.siteUrl, id, row.number)!"
                target="_blank"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-external-link"
                :aria-label="`Watch episode ${row.number} on RuengFlix`"
                :title="`Watch episode ${row.number} on RuengFlix`"
              />
              <UButton
                v-if="canWrite && (row.likes || row.dislikes)"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-eraser"
                :aria-label="`Reset votes for episode ${row.number}`"
                :title="`Reset votes for episode ${row.number}`"
                @click="confirmReset = { episode: row.number }"
              />
            </div>
          </template>
          <template #empty-state>
            <EmptyState icon="i-lucide-film" title="No released episodes" description="Enable a Public video in this collection to release it." />
          </template>
        </DataTable>
      </UCard>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <!-- Alerts -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">New-episode alerts</h2>
            <p class="text-sm text-muted">
              RuengFlix messages followers on Telegram when an episode comes out.<template v-if="series.lastAlert">
                Last: episode {{ series.lastAlert.episode }}, {{ formatRelativeTime(series.lastAlert.at) }}.</template
              >
            </p>
          </template>
          <div v-if="canWrite" class="flex flex-wrap items-end gap-2 mb-4">
            <UFormField label="Episode">
              <UInputNumber v-model="alertEpisode" :min="1" :max="Math.max(1, series.episodes)" class="w-28" />
            </UFormField>
            <UButton
              icon="i-lucide-send"
              :loading="sendingAlert"
              :disabled="series.state !== 'LIVE' || !series.followers || !detail.siteConnected"
              :title="
                !detail.siteConnected
                  ? 'Set RUENGFLIX_URL and RUENGFLIX_NOTIFY_SECRET on the server'
                  : !series.followers
                    ? 'Nobody follows this series yet'
                    : `Message ${series.followers} followers now`
              "
              @click="confirmAlert = true"
              >Send alert now</UButton
            >
          </div>
          <DataTable :rows="alertRows" :columns="alertColumns" :columns-toggleable="false">
            <template #source-data="{ row }">
              <UBadge :color="row.source === 'MANUAL' ? 'info' : 'neutral'" variant="subtle">{{
                row.source === 'MANUAL' ? 'Sent by hand' : 'Automatic'
              }}</UBadge>
            </template>
            <template #result-data="{ row }">
              {{ row.sent }}/{{ row.followers }} sent<template v-if="row.removed">, {{ row.removed }} blocked the bot</template
              ><template v-if="row.failed">, {{ row.failed }} failed</template>
            </template>
            <template #empty-state>
              <p class="text-sm text-muted py-4 text-center">No alerts sent yet.</p>
            </template>
          </DataTable>
        </UCard>

        <!-- Followers -->
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">Followers</h2>
            <p class="text-sm text-muted">Telegram chats that asked for alerts about this series.</p>
          </template>
          <DataTable :rows="followerRows" :columns="followerColumns" :columns-toggleable="false" row-key="chatId">
            <template #actions-data="{ row }">
              <UButton
                v-if="canWrite"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-user-x"
                :aria-label="`Remove chat ${row.chatId}`"
                :title="`Remove chat ${row.chatId}`"
                @click="confirmRemove = row"
              />
            </template>
            <template #empty-state>
              <p class="text-sm text-muted py-4 text-center">Nobody follows this series yet.</p>
            </template>
          </DataTable>
        </UCard>
      </div>
    </template>

    <ConfirmModal
      :model-value="confirmReset !== null"
      title="Reset votes"
      :description="
        confirmReset?.episode
          ? `Set 👍 and 👎 for episode ${confirmReset.episode} back to zero? Plays are kept. This can't be undone.`
          : 'Set 👍 and 👎 for every episode of this series back to zero? Plays are kept. This can\'t be undone.'
      "
      confirm-label="Reset votes"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirmReset = null)"
      @confirm="confirmReset && onResetVotes(confirmReset.episode)"
    />
    <ConfirmModal
      :model-value="confirmRemove !== null"
      title="Remove follower"
      :description="`Stop alerts for Telegram chat ${confirmRemove?.chatId ?? ''} about this series? They can follow it again from the bot.`"
      confirm-label="Remove"
      color="error"
      :loading="busy"
      @update:model-value="(v: boolean) => !v && !busy && (confirmRemove = null)"
      @confirm="confirmRemove && onRemoveFollower(confirmRemove)"
    />
    <ConfirmModal
      :model-value="confirmAlert"
      title="Send alert now"
      :description="`Message all ${series?.followers ?? 0} followers on Telegram that episode ${alertEpisode ?? ''} of “${series?.title ?? ''}” is out?`"
      confirm-label="Send"
      :loading="sendingAlert"
      @update:model-value="(v: boolean) => !v && !sendingAlert && (confirmAlert = false)"
      @confirm="onSendAlert"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { AlertLogEntry, SeriesFollower, StreamingEpisode, StreamingSeriesDetail } from '~/composables/useStreaming'
import { SERIES_STATE_META, biggestDropOff, continuePercents, finishPercent, likePercent, ruengflixUrl } from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const route = useRoute()
const id = computed(() => Number(route.params.id))
const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const detail = ref<StreamingSeriesDetail | null>(null)
const series = computed(() => detail.value?.series ?? null)
const loading = ref(false)
const error = ref('')
const alertRows = ref<AlertLogEntry[]>([])
const followerRows = ref<SeriesFollower[]>([])
const busy = ref(false)

const seriesLink = computed(() => (detail.value ? ruengflixUrl(detail.value.siteUrl, id.value) : null))
const finishSub = computed(() => {
  const p = series.value ? finishPercent(series.value.totals.starts, series.value.totals.completes) : null
  return p == null ? 'none yet' : `${p}% watched to the end`
})
const likeValue = computed(() => {
  const p = series.value ? likePercent(series.value.totals.likes, series.value.totals.dislikes) : null
  return p == null ? '—' : `${p}% 👍`
})

type EpisodeRow = StreamingEpisode & { finish: number | null; continue: number | null }
const episodeRows = computed<EpisodeRow[]>(() => {
  const eps = detail.value?.episodes ?? []
  const cont = continuePercents(eps)
  return eps.map((e, i) => ({ ...e, finish: finishPercent(e.starts, e.completes), continue: cont[i] ?? null }))
})
const dropOff = computed(() => biggestDropOff(detail.value?.episodes ?? []))

const episodeColumns: ColumnDef<EpisodeRow>[] = [
  { key: 'number', label: 'Ep.' },
  { key: 'title' },
  { key: 'durationSeconds', label: 'Length', value: (r) => (r.durationSeconds == null ? '—' : formatDuration(r.durationSeconds)) },
  { key: 'starts', label: 'Plays', type: 'number' },
  { key: 'finish', label: 'Finish' },
  { key: 'continue', label: 'Continue' },
  { key: 'votes', label: 'Votes' },
  { key: 'actions', label: '' }
]
const alertColumns: ColumnDef<AlertLogEntry>[] = [
  { key: 'at', label: 'When', type: 'datetime' },
  { key: 'episode', label: 'Episode' },
  { key: 'source', label: 'How' },
  { key: 'result', label: 'Result' }
]
const followerColumns: ColumnDef<SeriesFollower>[] = [
  { key: 'chatId', label: 'Telegram chat' },
  { key: 'since', label: 'Following since', type: 'datetime' },
  { key: 'actions', label: '' }
]

const alertEpisode = ref<number | undefined>()
const sendingAlert = ref(false)
const confirmAlert = ref(false)
const confirmReset = ref<{ episode: number | null } | null>(null)
const confirmRemove = ref<SeriesFollower | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [d, a, f] = await Promise.all([streaming.detail(id.value), streaming.alerts(id.value), streaming.followers(id.value)])
    detail.value = d
    alertRows.value = a
    followerRows.value = f
    alertEpisode.value = d.series.episodes || undefined
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function onResetVotes(episode: number | null) {
  busy.value = true
  try {
    await streaming.resetVotes(id.value, episode ?? undefined)
    toast.add({ title: episode ? `Votes reset for episode ${episode}` : 'Votes reset', color: 'success' })
    confirmReset.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not reset votes', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onRemoveFollower(f: SeriesFollower) {
  busy.value = true
  try {
    await streaming.removeFollower(id.value, f.chatId)
    toast.add({ title: 'Follower removed', color: 'success' })
    confirmRemove.value = null
    followerRows.value = followerRows.value.filter((x) => x.chatId !== f.chatId)
    if (detail.value) detail.value.series.followers = followerRows.value.length
  } catch (err) {
    toast.add({ title: 'Could not remove the follower', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function onSendAlert() {
  sendingAlert.value = true
  try {
    const r = await streaming.sendAlert(id.value, alertEpisode.value)
    toast.add({
      title: `Alert for episode ${r.episode} sent`,
      description: r.followers != null ? `${r.sent ?? 0} of ${r.followers} followers reached.` : undefined,
      color: 'success'
    })
    confirmAlert.value = false
    alertRows.value = await streaming.alerts(id.value)
  } catch (err) {
    toast.add({ title: 'Could not send the alert', description: apiErrorMessage(err), color: 'error' })
  } finally {
    sendingAlert.value = false
  }
}

watch(id, load)
onMounted(load)
</script>
