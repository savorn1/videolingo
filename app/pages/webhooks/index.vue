<template>
  <div>
    <PageHeader title="Webhooks" description="Tell other systems when something happens here — a job finishes, a subtitle is approved — by POSTing a signed JSON message to their URL.">
      <template #actions>
        <UButton v-if="canWrite" icon="i-lucide-plus" @click="openForm(null)">New webhook</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #name-data="{ row }">
          <div class="min-w-0 max-w-md">
            <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
            <p class="text-xs text-gray-500 font-mono truncate" :title="row.url">{{ row.url }}</p>
          </div>
        </template>
        <template #events-data="{ row }">
          <div class="flex flex-wrap gap-1 max-w-xs">
            <UBadge v-for="e in row.events" :key="e" size="sm" color="neutral" variant="subtle">{{ eventLabel(e) }}</UBadge>
          </div>
        </template>
        <template #health-data="{ row }">
          <UBadge v-if="!row.enabled" color="neutral" variant="subtle">Off</UBadge>
          <UBadge v-else-if="row.lastStatus === null" color="neutral" variant="subtle">Nothing sent yet</UBadge>
          <UBadge v-else-if="row.consecutiveFailures === 0" color="success" variant="subtle" :title="formatDateTime(row.lastDeliveryAt)">
            OK · {{ row.lastStatus }}
          </UBadge>
          <UBadge v-else color="error" variant="subtle" :title="formatDateTime(row.lastDeliveryAt)">
            Failing · {{ row.lastStatus || 'no response' }} ({{ row.consecutiveFailures }}×)
          </UBadge>
        </template>
        <template #lastDeliveryAt-data="{ row }">
          <span :title="formatDateTime(row.lastDeliveryAt)">{{ row.lastDeliveryAt ? formatRelativeTime(row.lastDeliveryAt) : '—' }}</span>
        </template>
        <template #actions-data="{ row }">
          <div class="min-w-max">
            <RowActions :actions="rowActions(row)" :max="2" />
          </div>
        </template>
        <template #empty-state>
          <EmptyState icon="i-lucide-webhook" title="No webhooks yet" description="Add one to push job results and review decisions to Slack, an LMS, or your own service.">
            <template v-if="canWrite" #action>
              <UButton icon="i-lucide-plus" @click="openForm(null)">New webhook</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </UCard>

    <!-- Create / edit -->
    <UModal v-model:open="showForm" :title="editing ? `Edit “${editing.name}”` : 'New webhook'" :ui="{ content: 'sm:max-w-lg' }">
      <template #body>
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField label="Name" required>
            <UInput v-model="form.name" maxlength="100" placeholder="e.g. LMS sync" class="w-full" autofocus />
          </UFormField>
          <UFormField label="URL" required description="Must be a public https:// address. Redirects aren't followed.">
            <UInput v-model="form.url" type="url" maxlength="1000" placeholder="https://example.com/hooks/videolingo" class="w-full font-mono" />
          </UFormField>
          <UFormField label="Events" required>
            <div class="space-y-2">
              <UCheckbox
                v-for="e in WEBHOOK_EVENTS"
                :key="e.value"
                :model-value="form.events.includes(e.value)"
                :label="e.label"
                :description="e.description"
                @update:model-value="(on: boolean | 'indeterminate') => toggleEvent(e.value, on === true)"
              />
            </div>
          </UFormField>
          <USwitch v-model="form.enabled" label="Enabled" />
          <UAlert v-if="formError" color="error" variant="subtle" :title="formError" icon="i-lucide-triangle-alert" />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showForm = false">Cancel</UButton>
            <UButton type="submit" :loading="saving" :disabled="!form.name.trim() || !form.url.trim() || !form.events.length">
              {{ editing ? 'Save' : 'Create' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>

    <!-- Details: secret + deliveries -->
    <USlideover v-model:open="showDetail" :title="detail?.name ?? 'Webhook'" :description="detail?.url" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <div v-if="detail" class="space-y-6">
          <section>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Signing secret</h3>
            <div class="flex gap-2">
              <UInput :model-value="revealSecret ? detail.secret : '•'.repeat(24)" readonly class="flex-1 font-mono" aria-label="Signing secret" />
              <UButton color="neutral" variant="soft" :icon="revealSecret ? 'i-lucide-eye-off' : 'i-lucide-eye'" :aria-label="revealSecret ? 'Hide' : 'Show'" @click="revealSecret = !revealSecret" />
              <UButton v-if="canWrite" color="neutral" variant="soft" icon="i-lucide-refresh-cw" @click="confirmRotate = true">Rotate</UButton>
            </div>
            <details class="mt-2 text-xs text-gray-600 dark:text-gray-300">
              <summary class="cursor-pointer">How receivers verify a message</summary>
              <div class="mt-2 space-y-2">
                <p>
                  Each request has an <code>X-VideoLingo-Signature: t=&lt;unix time&gt;,v1=&lt;hex&gt;</code> header. Recompute
                  <code>HMAC-SHA256(secret, t + "." + rawBody)</code>, compare it with <code>v1</code>, and reject messages whose <code>t</code> is more than
                  a few minutes old.
                </p>
                <pre class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto"><code>{{ verifySnippet }}</code></pre>
              </div>
            </details>
          </section>

          <section>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Recent deliveries</h3>
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-refresh-cw" :loading="deliveriesLoading" @click="loadDeliveries">Refresh</UButton>
            </div>
            <p v-if="!deliveries.length && !deliveriesLoading" class="text-sm text-gray-500">Nothing sent yet — try “Send test”.</p>
            <ul class="space-y-2">
              <li v-for="d in deliveries" :key="d.id" class="rounded-lg border border-gray-200 dark:border-gray-800 text-sm">
                <button type="button" class="w-full flex items-center gap-2 px-3 py-2 text-left" @click="expanded = expanded === d.id ? null : d.id">
                  <UIcon :name="d.success ? 'i-lucide-check-circle' : 'i-lucide-x-circle'" :class="d.success ? 'text-success-500' : 'text-error-500'" class="w-4 h-4 shrink-0" />
                  <span class="font-medium">{{ eventLabel(d.event) }}</span>
                  <UBadge size="sm" :color="d.success ? 'success' : 'error'" variant="subtle">{{ d.status || 'No response' }}</UBadge>
                  <span v-if="d.attempt > 1" class="text-xs text-gray-500">attempt {{ d.attempt }}</span>
                  <span class="ml-auto text-xs text-gray-500" :title="formatDateTime(d.createdAt)">{{ formatRelativeTime(d.createdAt) }} · {{ d.durationMs }} ms</span>
                </button>
                <div v-if="expanded === d.id" class="border-t border-gray-100 dark:border-gray-800 px-3 py-2 space-y-2">
                  <p v-if="d.detail" class="text-xs text-gray-600 dark:text-gray-300 break-words">{{ d.detail }}</p>
                  <pre class="text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 overflow-x-auto">{{ pretty(d.payload) }}</pre>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </template>
    </USlideover>

    <ConfirmModal
      :model-value="confirmDelete !== null"
      title="Delete webhook"
      :description="`Delete “${confirmDelete?.name ?? ''}”? Messages stop immediately and its delivery log is removed.`"
      confirm-label="Delete"
      color="error"
      :loading="saving"
      @update:model-value="(v: boolean) => !v && !saving && (confirmDelete = null)"
      @confirm="confirmDelete && onDelete(confirmDelete)"
    />
    <ConfirmModal
      v-model="confirmRotate"
      title="Rotate signing secret"
      description="The old secret stops working straight away — update the receiver with the new one, or it will reject our messages."
      confirm-label="Rotate"
      :loading="saving"
      @confirm="onRotate"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, RowAction } from '#shared/types'
import { WEBHOOK_EVENTS, type Webhook, type WebhookDelivery } from '~/composables/useWebhooks'

definePageMeta({ middleware: 'admin' })

const { list, create, update, remove, rotateSecret, sendTest, deliveries: listDeliveries } = useWebhooks()
const { can } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('webhooks', 'WRITE'))

const rows = ref<Webhook[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const columns: ColumnDef<Webhook>[] = [
  { key: 'name', value: (r) => `${r.name} (${r.url})` },
  { key: 'events', value: (r) => r.events.join(', ') },
  { key: 'health', label: 'Status', value: (r) => (!r.enabled ? 'Off' : r.consecutiveFailures ? 'Failing' : 'OK') },
  { key: 'lastDeliveryAt', label: 'Last sent' },
  { key: 'actions', label: '' }
]

const eventLabel = (e: string) => WEBHOOK_EVENTS.find((x) => x.value === e)?.label ?? (e === 'webhook.test' ? 'Test' : e)
const pretty = (json: string) => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await list()
  } catch (err) {
    error.value = apiErrorMessage(err)
  } finally {
    loading.value = false
  }
}

function rowActions(row: Webhook): RowAction[] {
  return [
    { label: 'Details', icon: 'i-lucide-list', color: 'primary', onClick: () => openDetail(row) },
    ...(canWrite.value
      ? [
          { label: 'Send test', icon: 'i-lucide-send', onClick: () => onTest(row) },
          { label: 'Edit', icon: 'i-lucide-pencil', onClick: () => openForm(row) },
          { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onClick: () => (confirmDelete.value = row) }
        ]
      : [])
  ]
}

// ── Create / edit ──────────────────────────────────────────────────────────
const showForm = ref(false)
const editing = ref<Webhook | null>(null)
const form = reactive<{ name: string; url: string; events: string[]; enabled: boolean }>({ name: '', url: '', events: [], enabled: true })
const formError = ref('')

function openForm(row: Webhook | null) {
  editing.value = row
  Object.assign(form, {
    name: row?.name ?? '',
    url: row?.url ?? '',
    events: row ? [...row.events] : ['job.succeeded', 'job.failed'],
    enabled: row?.enabled ?? true
  })
  formError.value = ''
  showForm.value = true
}

function toggleEvent(event: string, on: boolean) {
  form.events = on ? [...new Set([...form.events, event])] : form.events.filter((e) => e !== event)
}

async function onSubmit() {
  saving.value = true
  formError.value = ''
  try {
    const payload = { name: form.name.trim(), url: form.url.trim(), events: form.events, enabled: form.enabled }
    if (editing.value) await update(editing.value.id, payload)
    else await create(payload)
    toast.add({ title: editing.value ? 'Webhook saved' : 'Webhook created', description: editing.value ? undefined : 'Send a test to check the receiver.', color: 'success' })
    showForm.value = false
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

async function onTest(row: Webhook) {
  try {
    const d = await sendTest(row.id)
    toast.add({
      title: d.success ? `Test delivered (${d.status})` : `Test failed${d.status ? ` (${d.status})` : ''}`,
      description: d.success ? undefined : (d.detail ?? undefined),
      color: d.success ? 'success' : 'error'
    })
    await load()
    if (detail.value?.id === row.id) loadDeliveries()
  } catch (err) {
    toast.add({ title: 'Could not send test', description: apiErrorMessage(err), color: 'error' })
  }
}

// ── Details ────────────────────────────────────────────────────────────────
const showDetail = ref(false)
const detail = ref<Webhook | null>(null)
const revealSecret = ref(false)
const deliveries = ref<WebhookDelivery[]>([])
const deliveriesLoading = ref(false)
const expanded = ref<number | null>(null)

function openDetail(row: Webhook) {
  detail.value = row
  revealSecret.value = false
  expanded.value = null
  deliveries.value = []
  showDetail.value = true
  loadDeliveries()
}

async function loadDeliveries() {
  if (!detail.value) return
  deliveriesLoading.value = true
  try {
    deliveries.value = await listDeliveries(detail.value.id)
  } catch (err) {
    toast.add({ title: 'Could not load deliveries', description: apiErrorMessage(err), color: 'error' })
  } finally {
    deliveriesLoading.value = false
  }
}

const verifySnippet = `// Node.js
const crypto = require('crypto')
function verify(secret, header, rawBody) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex')
  const given = Buffer.from(parts.v1 ?? '')
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), given)
}`

const confirmRotate = ref(false)
async function onRotate() {
  if (!detail.value) return
  saving.value = true
  try {
    detail.value = await rotateSecret(detail.value.id)
    revealSecret.value = true
    confirmRotate.value = false
    toast.add({ title: 'New signing secret created', description: 'Update the receiver with it.', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Could not rotate the secret', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

const confirmDelete = ref<Webhook | null>(null)
async function onDelete(row: Webhook) {
  saving.value = true
  try {
    await remove(row.id)
    toast.add({ title: `“${row.name}” deleted`, color: 'success' })
    confirmDelete.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not delete webhook', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
