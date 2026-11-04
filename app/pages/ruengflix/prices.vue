<template>
  <div>
    <PageHeader
      title="Prices"
      description="What RuengFlix charges with KHQR (US dollars) on its VIP page and on the wall after a VIP series' free episodes, and how coins work."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Prices' }]"
    />

    <UAlert
      class="mb-4"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Payments go through KHQR"
      description="Viewers pay with any Cambodian banking app. With a Bakong token on movie-api, payments are confirmed automatically; otherwise confirm them under Orders. Purchases and coins belong to the viewer's account."
    />
    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard class="max-w-2xl">
      <DetailSkeleton v-if="loading && !view" />
      <form v-else class="space-y-4" @submit.prevent="onSave">
        <UFormField v-for="f in PRICE_FIELDS" :key="f.key" :label="f.label" :hint="f.hint || undefined">
          <UInputNumber
            v-model="form[f.key]"
            :min="0"
            :max="1000"
            :step="0.01"
            :format-options="{ style: 'currency', currency: 'USD' }"
            :disabled="!canWrite"
            class="w-48"
          />
          <template v-if="view && form[f.key] !== view.defaults[f.key]" #help>Default {{ formatUsd(view.defaults[f.key]) }}</template>
        </UFormField>

        <USeparator label="Coins" class="pt-2" />
        <p class="text-sm text-muted">Leave a field empty to use RuengFlix's default.</p>
        <UFormField v-for="f in COIN_PACK_FIELDS" :key="f.key" :label="f.label" :hint="f.hint || undefined">
          <UInputNumber
            v-model="coinForm[f.key]"
            :min="0.01"
            :max="1000"
            :step="0.01"
            :format-options="{ style: 'currency', currency: 'USD' }"
            :disabled="!canWrite"
            class="w-48"
            :placeholder="view ? formatUsd(Number(view.defaults[f.key])) : ''"
          />
        </UFormField>
        <UFormField v-for="f in COIN_FIELDS" :key="f.key" :label="f.label" :hint="f.hint">
          <UInputNumber
            v-model="coinForm[f.key]"
            :min="1"
            :max="f.max"
            :step="1"
            :format-options="{ useGrouping: false }"
            :disabled="!canWrite"
            class="w-48"
            :placeholder="view ? String(view.defaults[f.key] ?? '') : ''"
          />
        </UFormField>

        <UAlert v-if="problems.length && tried" color="error" variant="subtle" title="Fix before saving" icon="i-lucide-triangle-alert">
          <template #description>
            <ul class="list-disc ps-4">
              <li v-for="p in problems" :key="p">{{ p }}</li>
            </ul>
          </template>
        </UAlert>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
          <p class="text-xs text-muted">
            <template v-if="view?.customized && view.updatedAt"
              >Last changed by {{ view.updatedBy ?? 'someone' }} {{ formatRelativeTime(view.updatedAt) }}.</template
            >
            <template v-else>Using the built-in prices.</template>
            The site shows changes within a minute.
          </p>
          <div v-if="canWrite" class="flex gap-2">
            <UButton color="neutral" variant="ghost" :disabled="!dirty" @click="fill()">Discard</UButton>
            <UButton type="submit" icon="i-lucide-save" :loading="saving" :disabled="!dirty">Save prices</UButton>
          </div>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { PricesView, StreamingPrices } from '~/composables/useStreaming'
import {
  COIN_FIELDS,
  COIN_PACK_FIELDS,
  PRICE_FIELDS,
  coinProblems,
  priceProblems,
  type CoinKey,
  type CoinPackKey,
  type PriceKey
} from '#shared/utils/ruengflix'

definePageMeta({ middleware: 'admin' })

const streaming = useStreaming()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('streaming', 'WRITE'))

const view = ref<PricesView | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const tried = ref(false)
const form = reactive<Record<PriceKey, number | undefined>>({
  seriesUnlockPrice: undefined,
  vip1Month: undefined,
  vip3Months: undefined,
  vip6Months: undefined,
  vip12Months: undefined
})

const coinForm = reactive<Record<CoinPackKey | CoinKey, number | undefined>>({
  coinPack100: undefined,
  coinPack300: undefined,
  coinPack1000: undefined,
  episodeUnlockCoins: undefined,
  dailyCheckInCoins: undefined
})
const COIN_KEYS = [...COIN_PACK_FIELDS, ...COIN_FIELDS].map((f) => f.key)
const stored = (v: unknown) => (v == null ? undefined : Number(v))

const problems = computed(() => [...priceProblems(form), ...coinProblems(coinForm)])
const dirty = computed(
  () =>
    !!view.value &&
    (PRICE_FIELDS.some((f) => form[f.key] !== Number(view.value!.values[f.key])) || COIN_KEYS.some((k) => coinForm[k] !== stored(view.value!.values[k])))
)

function fill() {
  if (!view.value) return
  for (const f of PRICE_FIELDS) form[f.key] = Number(view.value.values[f.key])
  for (const k of COIN_KEYS) coinForm[k] = stored(view.value.values[k])
  tried.value = false
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    view.value = await streaming.prices()
    fill()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

async function onSave() {
  tried.value = true
  if (problems.value.length || !view.value) return
  saving.value = true
  try {
    const coins = Object.fromEntries(COIN_KEYS.map((k) => [k, coinForm[k] ?? null]))
    view.value = await streaming.savePrices({ ...form, ...coins } as StreamingPrices, view.value.version)
    fill()
    toast.add({ title: 'Prices saved', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not save the prices', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
