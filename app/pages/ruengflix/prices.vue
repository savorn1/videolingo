<template>
  <div>
    <PageHeader
      title="Prices"
      description="What RuengFlix shows on its VIP page and on the wall after a VIP series' free episodes, in US dollars."
      :crumbs="[{ label: 'RuengFlix', to: '/ruengflix' }, { label: 'Prices' }]"
    />

    <UAlert
      class="mb-4"
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Payments aren't connected yet"
      description="RuengFlix shows these prices, but KHQR payment isn't built, so nobody can pay or unlock yet. Unlocks are only stored in the viewer's browser."
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
import { PRICE_FIELDS, priceProblems, type PriceKey } from '#shared/utils/ruengflix'

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

const problems = computed(() => priceProblems(form))
const dirty = computed(() => !!view.value && PRICE_FIELDS.some((f) => form[f.key] !== Number(view.value!.values[f.key])))

function fill() {
  if (!view.value) return
  for (const f of PRICE_FIELDS) form[f.key] = Number(view.value.values[f.key])
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
    view.value = await streaming.savePrices({ ...form } as StreamingPrices, view.value.version)
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
