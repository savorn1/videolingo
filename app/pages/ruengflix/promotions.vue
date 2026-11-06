<template>
  <div>
    <PageHeader
      title="Promotions"
      description="Time-limited offers RuengFlix shows with a countdown: a VIP series free for everyone, or extra coins on every coin pack. Times are in the server's time zone."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Promotions' }]"
    />

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard v-if="canWrite" class="mb-4">
      <template #header>
        <h2 class="font-semibold text-highlighted">Schedule a promotion</h2>
      </template>
      <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <UFormField label="Offer" class="sm:col-span-2">
          <UTabs v-model="form.kind" :items="kindItems" :content="false" size="sm" />
        </UFormField>
        <UFormField label="Banner title" required class="sm:col-span-2" hint="shown on the site, in Khmer">
          <UInput v-model="form.title" maxlength="120" placeholder="មើលឥតគិតថ្លៃចុងសប្តាហ៍" class="w-full" />
        </UFormField>
        <UFormField v-if="form.kind === 'FREE_SERIES'" label="Series" required class="sm:col-span-2" hint="VIP series only">
          <USelectMenu
            v-model="form.seriesId"
            :items="seriesOptions"
            value-key="value"
            placeholder="Pick a VIP series"
            :search-input="{ placeholder: 'Search series…' }"
            class="w-full"
          />
        </UFormField>
        <UFormField v-else label="Extra coins" required hint="% on every pack (1–200)">
          <UInputNumber v-model="form.bonusPercent" :min="1" :max="200" class="w-full" />
        </UFormField>
        <UFormField label="Starts" required>
          <UInput v-model="form.startsAt" type="datetime-local" class="w-full" />
        </UFormField>
        <UFormField label="Ends" required hint="up to 31 days after the start">
          <UInput v-model="form.endsAt" type="datetime-local" class="w-full" />
        </UFormField>
        <div class="sm:col-span-2 flex flex-wrap gap-2">
          <UButton type="submit" :loading="saving" icon="i-lucide-calendar-plus">Schedule</UButton>
          <UButton color="neutral" variant="ghost" @click="preset(2)">This weekend (48 h from now)</UButton>
          <UButton color="neutral" variant="ghost" @click="preset(0.25)">Next 6 hours</UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #title-data="{ row }">
          <p class="font-medium text-highlighted">{{ row.title }}</p>
          <p class="text-xs text-muted">
            <template v-if="row.kind === 'FREE_SERIES'">
              Free: <NuxtLink :to="`/ruengflix/${row.seriesId}`" class="hover:underline">{{ row.seriesTitle }}</NuxtLink>
            </template>
            <template v-else>+{{ row.bonusPercent }}% coins on every pack</template>
          </p>
        </template>
        <template #state-data="{ row }">
          <UBadge :color="row.state === 'RUNNING' ? 'success' : row.state === 'SCHEDULED' ? 'info' : 'neutral'" variant="subtle">{{
            stateLabel[row.state as StreamingPromotion['state']]
          }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <UButton
            v-if="canWrite"
            size="xs"
            :color="row.state === 'RUNNING' ? 'warning' : 'neutral'"
            variant="ghost"
            :loading="busyId === row.id"
            @click="stop(row)"
          >
            {{ row.state === 'RUNNING' ? 'End now' : 'Remove' }}
          </UButton>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-ticket-percent"
            title="No promotions"
            description="Schedule one above; the site shows it with a countdown while it runs."
          />
        </template>
      </DataTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { PromotionKind, StreamingPromotion } from '~/composables/useStreaming'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const rows = ref<StreamingPromotion[]>([])
const seriesOptions = ref<{ label: string; value: number }[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const busyId = ref<number | null>(null)

const kindItems = [
  { label: 'Series free', value: 'FREE_SERIES' },
  { label: 'Extra coins', value: 'COIN_BONUS' }
]
const stateLabel: Record<StreamingPromotion['state'], string> = { RUNNING: 'Running', SCHEDULED: 'Scheduled', ENDED: 'Ended' }

/** "YYYY-MM-DDTHH:mm" in the browser's time (the admin's), for datetime-local inputs */
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

const form = reactive({
  kind: 'FREE_SERIES' as PromotionKind,
  title: '',
  seriesId: undefined as number | undefined,
  bonusPercent: 30,
  startsAt: local(new Date()),
  endsAt: local(new Date(Date.now() + 48 * 3600_000))
})

function preset(days: number) {
  form.startsAt = local(new Date())
  form.endsAt = local(new Date(Date.now() + days * 86_400_000))
}

const columns: ColumnDef<StreamingPromotion>[] = [
  { key: 'title', label: 'Promotion' },
  { key: 'state', value: (r) => stateLabel[r.state] },
  { key: 'startsAt', label: 'Starts', type: 'datetime' },
  { key: 'endsAt', label: 'Ends', type: 'datetime' },
  { key: 'createdBy', label: 'By' },
  { key: 'actions', label: '' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [promos, overview] = await Promise.all([streaming.promotions(), streaming.overview()])
    rows.value = promos
    seriesOptions.value = overview.series.filter((s) => s.vip).map((s) => ({ label: s.title, value: s.id }))
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save() {
  saving.value = true
  try {
    await streaming.createPromotion({
      kind: form.kind,
      title: form.title,
      seriesId: form.kind === 'FREE_SERIES' ? (form.seriesId ?? null) : null,
      bonusPercent: form.kind === 'COIN_BONUS' ? form.bonusPercent : null,
      startsAt: form.startsAt,
      endsAt: form.endsAt
    })
    toast.add({ title: 'Promotion scheduled', description: 'The site picks it up within a minute.', color: 'success' })
    form.title = ''
    await load()
  } catch (err) {
    toast.add({ title: 'Could not schedule', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function stop(row: StreamingPromotion) {
  busyId.value = row.id
  try {
    await streaming.stopPromotion(row.id)
    await load()
  } catch (err) {
    toast.add({ title: 'Could not change it', description: apiErrorMessage(err), color: 'error' })
  } finally {
    busyId.value = null
  }
}
</script>
