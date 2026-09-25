<template>
  <div>
    <PageHeader
      title="API keys"
      description="Let other systems call the VideoLingo API. A key acts as the account that created it, with the same permissions — never more."
    >
      <template #actions>
        <UButton v-if="canWrite" icon="i-lucide-plus" @click="openCreate">New key</UButton>
      </template>
    </PageHeader>

    <UAlert v-if="error" color="error" variant="subtle" class="mb-4" :title="error" icon="i-lucide-triangle-alert" />

    <UCard class="mb-4">
      <div class="text-sm text-gray-600 dark:text-gray-300 space-y-2">
        <p>Send the key in an <code class="text-xs">X-API-Key</code> header (or as <code class="text-xs">Authorization: Bearer vl_…</code>):</p>
        <pre
          class="text-xs bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto"
        ><code>curl -H "X-API-Key: vl_…" {{ origin }}/api/admin/videos</code></pre>
        <p class="text-xs text-gray-500">Calls made with a key show up in the audit log with a key icon. Keys can't create or revoke other keys.</p>
      </div>
    </UCard>

    <UCard>
      <DataTable :rows="rows" :columns="columns" :loading="loading" refreshable @refresh="load">
        <template #name-data="{ row }">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
            <code class="text-xs text-gray-500">{{ row.prefix }}…</code>
          </div>
        </template>
        <template #state-data="{ row }">
          <UBadge v-if="row.revokedAt" color="cancelled" variant="subtle" :title="`Revoked by ${row.revokedBy} ${formatDateTime(row.revokedAt)}`"
            >Revoked</UBadge
          >
          <UBadge v-else-if="!row.active" color="error" variant="subtle">Expired</UBadge>
          <UBadge v-else color="success" variant="subtle">Active</UBadge>
        </template>
        <template #lastUsedAt-data="{ row }">
          <span :title="formatDateTime(row.lastUsedAt)">{{ row.lastUsedAt ? formatRelativeTime(row.lastUsedAt) : 'Never' }}</span>
        </template>
        <template #expiresAt-data="{ row }">
          <span :title="formatDateTime(row.expiresAt)">{{ row.expiresAt ? formatDate(row.expiresAt) : 'Never' }}</span>
        </template>
        <template #actions-data="{ row }">
          <UButton v-if="canWrite && !row.revokedAt" size="xs" color="error" variant="soft" icon="i-lucide-ban" @click="confirmRevoke = row">Revoke</UButton>
        </template>
        <template #empty-state>
          <EmptyState
            icon="i-lucide-key-round"
            title="No API keys"
            description="Create one for each system that needs access, so you can revoke them separately."
          >
            <template v-if="canWrite" #action>
              <UButton icon="i-lucide-plus" @click="openCreate">New key</UButton>
            </template>
          </EmptyState>
        </template>
      </DataTable>
    </UCard>

    <!-- Create -->
    <UModal v-model:open="showCreate" :title="created ? 'Copy your new key' : 'New API key'" :ui="{ content: 'sm:max-w-lg' }" :dismissible="!created">
      <template #body>
        <div v-if="created" class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-eye-off"
            title="This is the only time the key is shown"
            description="Store it somewhere safe, like a secrets manager. If it's lost, revoke it and create another."
          />
          <div class="flex gap-2">
            <UInput :model-value="created" readonly class="flex-1 font-mono" aria-label="API key" />
            <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copy">{{ copied ? 'Copied' : 'Copy' }}</UButton>
          </div>
          <div class="flex justify-end">
            <UButton @click="closeCreated">Done</UButton>
          </div>
        </div>
        <form v-else class="space-y-4" @submit.prevent="onCreate">
          <UFormField label="Name" required description="What uses it, e.g. “LMS sync” or “CI pipeline”.">
            <UInput v-model="form.name" maxlength="100" class="w-full" autofocus />
          </UFormField>
          <UFormField label="Expires">
            <USelect v-model="form.expiresInDays" :items="expiryOptions" class="w-full" />
          </UFormField>
          <p class="text-xs text-gray-500">
            It will act as <strong>{{ username }}</strong
            >{{ isAdmin ? ' (an administrator — it can do anything)' : ', with your role’s permissions' }}.
          </p>
          <UAlert v-if="formError" color="error" variant="subtle" :title="formError" icon="i-lucide-triangle-alert" />
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showCreate = false">Cancel</UButton>
            <UButton type="submit" icon="i-lucide-key-round" :loading="saving" :disabled="!form.name.trim()">Create key</UButton>
          </div>
        </form>
      </template>
    </UModal>

    <ConfirmModal
      :model-value="confirmRevoke !== null"
      title="Revoke API key"
      :description="`Revoke “${confirmRevoke?.name ?? ''}” (${confirmRevoke?.prefix ?? ''}…)? Anything still using it will start getting 401 errors straight away.`"
      confirm-label="Revoke"
      color="error"
      :loading="saving"
      @update:model-value="(v: boolean) => !v && !saving && (confirmRevoke = null)"
      @confirm="confirmRevoke && onRevoke(confirmRevoke)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '#shared/types'
import type { ApiKey } from '~/composables/useApiKeys'

definePageMeta({ middleware: 'admin' })

const { list, create, revoke } = useApiKeys()
const { can, isAdmin, username } = useAuth()
const toast = useToast()
const canWrite = computed(() => can('api-keys', 'WRITE'))
// Set after mount so the server- and client-rendered HTML match.
const origin = ref('')
onMounted(() => (origin.value = window.location.origin))

const rows = ref<ApiKey[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

const columns = computed<ColumnDef<ApiKey>[]>(() => [
  { key: 'name' },
  ...(isAdmin.value ? [{ key: 'username', label: 'Acts as' }] : []),
  { key: 'state', label: 'Status', value: (r: ApiKey) => (r.revokedAt ? 'Revoked' : r.active ? 'Active' : 'Expired') },
  { key: 'createdAt', label: 'Created', type: 'datetime' },
  { key: 'lastUsedAt', label: 'Last used' },
  { key: 'expiresAt', label: 'Expires' },
  { key: 'actions', label: '' }
])

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

const expiryOptions = [
  { label: 'In 30 days', value: 30 },
  { label: 'In 90 days', value: 90 },
  { label: 'In a year', value: 365 },
  { label: 'Never', value: null }
]
const showCreate = ref(false)
const form = reactive<{ name: string; expiresInDays: number | null }>({ name: '', expiresInDays: 90 })
const formError = ref('')
const created = ref('')
const copied = ref(false)

function openCreate() {
  Object.assign(form, { name: '', expiresInDays: 90 })
  formError.value = ''
  created.value = ''
  copied.value = false
  showCreate.value = true
}

async function onCreate() {
  saving.value = true
  formError.value = ''
  try {
    const res = await create(form.name.trim(), form.expiresInDays)
    created.value = res.secret
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err)
  } finally {
    saving.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(created.value)
    copied.value = true
  } catch {
    toast.add({ title: 'Could not copy — select the key and copy it by hand', color: 'warning' })
  }
}

function closeCreated() {
  created.value = ''
  showCreate.value = false
}

const confirmRevoke = ref<ApiKey | null>(null)
async function onRevoke(row: ApiKey) {
  saving.value = true
  try {
    await revoke(row.id)
    toast.add({ title: `“${row.name}” revoked`, color: 'success' })
    confirmRevoke.value = null
    await load()
  } catch (err) {
    toast.add({ title: 'Could not revoke key', description: apiErrorMessage(err), color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
